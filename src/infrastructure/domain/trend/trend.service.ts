import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Output } from 'ai';
import { subDays } from 'date-fns';
import * as crypto from 'crypto';
import * as googleTrends from 'google-trends-api';
import { AllUserLogRequest } from 'src/application/dtos/request/user-log.request';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import {
  AIResponseMetadata,
  AITrendForecastStructuredResponse
} from 'src/application/dtos/response/ai-structured.response';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import {
  ProductCardResponse,
  ProductCardVariantResponse
} from 'src/application/dtos/response/product-card.response';
import { ProductWithVariantsResponse } from 'src/application/dtos/response/product-with-variants.response';
import { INSTRUCTION_TYPE_TREND } from 'src/application/constant/prompts';
import {
  ProductCardOutputItem,
  ProductCardVariantOutput
} from 'src/chatbot/output/product.output';
import { AI_TREND_HELPER } from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { CACHE_TTL_1WEEK } from 'src/infrastructure/domain/common/cacheable/cacheable.constants';
import { AIHelper } from 'src/infrastructure/domain/helpers/ai.helper';
import { InventoryService } from 'src/infrastructure/domain/inventory/inventory.service';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { RestockService } from 'src/infrastructure/domain/restock/restock.service';
import { AIAcceptanceService } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.service';
import z from 'zod';

type VariantSalesSignal = {
  last30DaysSales: number;
  totalQuantitySold: number;
};

type TrendSeedStage = 'name' | 'attribute';

type TrendSeedKeyword = {
  keyword: string;
  stage: TrendSeedStage;
};

type GoogleTrendSignal = {
  keyword: string;
  score: number;
  source: 'interest_over_time' | 'related_query';
  stage: TrendSeedStage;
  parentKeyword?: string;
};

type TrendKeywordMapperResult = {
  primaryKeywords: string[];
  expansionKeywords: string[];
  negativeTerms: string[];
  confidence: number;
  explanation: string;
};

type TrendPipelineSource = 'live-google' | 'cache' | 'trend-log' | 'empty';

type TrendPipelineResult = {
  products: ProductCardResponse[];
  keywordsUsed: string[];
  sourceUsed: TrendPipelineSource;
  fallbackTier: 'none' | 'cache' | 'trend-log' | 'empty';
  googleSignals: GoogleTrendSignal[];
  mapperResult: TrendKeywordMapperResult;
};

type TrendProductsCachePayload = {
  version: 'trend-v2';
  generatedAt: string;
  products: ProductCardResponse[];
  keywordsUsed: string[];
  sourceUsed: TrendPipelineSource;
  fallbackTier: TrendPipelineResult['fallbackTier'];
  googleSignals: GoogleTrendSignal[];
  mapperResult: TrendKeywordMapperResult;
};

const TREND_PRODUCT_LIMIT = 15;
const TREND_SEARCH_PAGE_SIZE = 20;
const TREND_SEARCH_KEYWORD_LIMIT = 10;
const TREND_CACHE_PREFIX = 'trend_v2_products';
const GOOGLE_FETCH_TIMEOUT_MS = 12_000;
const GOOGLE_FETCH_RETRY_COUNT = 1;
const GOOGLE_FETCH_RETRY_DELAY_MS = 300;
const GOOGLE_TREND_GEO = 'VN';
const GOOGLE_SIGNAL_PROMPT_LIMIT = 40;
const FALLBACK_TREND_LOG_COUNT = 5;

const trendKeywordMapperSchema = z.object({
  primaryKeywords: z.array(z.string().min(1)).min(1).max(6),
  expansionKeywords: z.array(z.string().min(1)).max(8).default([]),
  negativeTerms: z.array(z.string().min(1)).max(8).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  explanation: z.string().min(1).max(600)
});

const emptyMapperResult: TrendKeywordMapperResult = {
  primaryKeywords: [],
  expansionKeywords: [],
  negativeTerms: [],
  confidence: 0,
  explanation: 'No mapper data available.'
};

@Injectable()
export class TrendService {
  constructor(
    @Inject(AI_TREND_HELPER) private readonly aiHelper: AIHelper,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly inventoryService: InventoryService,
    private readonly restockService: RestockService,
    private readonly productService: ProductService,
    private readonly aiAcceptanceService: AIAcceptanceService
  ) { }

  private readonly logger = new Logger(TrendService.name);

  private createRequestId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private safeParseJson<T = unknown>(value: unknown): T | null {
    if (typeof value !== 'string') {
      return (value as T) ?? null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  private normalizeKeyword(keyword: string): string {
    return keyword.trim().replace(/\s+/g, ' ');
  }

  private uniqueKeywords(keywords: string[], maxCount: number): string[] {
    const result: string[] = [];
    const seen = new Set<string>();

    for (const keyword of keywords) {
      const normalized = this.normalizeKeyword(keyword);
      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(normalized);
      if (result.length >= maxCount) {
        break;
      }
    }

    return result;
  }

  private getForceRefreshFlag(allUserLogRequest: AllUserLogRequest): boolean {
    const rawValue = (allUserLogRequest as { forceRefresh?: unknown }).forceRefresh;
    return rawValue === true || String(rawValue).toLowerCase() === 'true';
  }

  private toValidDate(value: unknown, fallback: Date): Date {
    if (!value) {
      return fallback;
    }

    const parsed = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }

  private resolveDateRange(allUserLogRequest: AllUserLogRequest): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    const endDate = this.toValidDate(allUserLogRequest.endDate, now);

    if (allUserLogRequest.startDate) {
      const startDate = this.toValidDate(allUserLogRequest.startDate, subDays(endDate, 30));
      return { startDate, endDate };
    }

    const period = String(allUserLogRequest.period ?? 'monthly').toLowerCase();
    if (period === 'weekly') {
      return { startDate: subDays(endDate, 7), endDate };
    }

    if (period === 'yearly') {
      return { startDate: subDays(endDate, 365), endDate };
    }

    return { startDate: subDays(endDate, 30), endDate };
  }

  private createCacheKey(allUserLogRequest: AllUserLogRequest): string {
    const range = this.resolveDateRange(allUserLogRequest);
    const context = {
      period: String(allUserLogRequest.period ?? 'monthly').toLowerCase(),
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString()
    };

    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(context))
      .digest('hex');

    return `${TREND_CACHE_PREFIX}:${hash}`;
  }

  private async wait(milliseconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    timeoutErrorMessage: string
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | null = null;

    return new Promise<T>((resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(timeoutErrorMessage));
      }, timeoutMs);

      operation()
        .then((value) => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          resolve(value);
        })
        .catch((error) => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          reject(error);
        });
    });
  }

  private async executeWithRetry<T>(
    requestId: string,
    operationName: string,
    keyword: string,
    operation: () => Promise<T>
  ): Promise<T | null> {
    for (let attempt = 0; attempt <= GOOGLE_FETCH_RETRY_COUNT; attempt++) {
      const startedAt = Date.now();

      try {
        const result = await this.withTimeout(
          operation,
          GOOGLE_FETCH_TIMEOUT_MS,
          `${operationName} timeout`
        );

        this.logger.log(
          `[Trend][GoogleFetch][SUCCESS] requestId=${requestId} operation=${operationName} keyword="${keyword}" attempt=${attempt + 1} durationMs=${Date.now() - startedAt}`
        );
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : JSON.stringify(error);

        this.logger.warn(
          `[Trend][GoogleFetch][FAIL] requestId=${requestId} operation=${operationName} keyword="${keyword}" attempt=${attempt + 1} durationMs=${Date.now() - startedAt} error=${errorMessage}`
        );

        if (attempt < GOOGLE_FETCH_RETRY_COUNT) {
          await this.wait(GOOGLE_FETCH_RETRY_DELAY_MS);
        }
      }
    }

    return null;
  }

  private extractInterestScore(rawPayload: unknown): number {
    const payload =
      rawPayload && typeof rawPayload === 'object'
        ? (rawPayload as Record<string, unknown>)
        : null;
    const defaultData =
      payload?.default && typeof payload.default === 'object'
        ? (payload.default as Record<string, unknown>)
        : null;
    const timelineData = Array.isArray(defaultData?.timelineData)
      ? defaultData.timelineData
      : [];

    if (timelineData.length === 0) {
      return 0;
    }

    const total = timelineData.reduce((sum, item) => {
      const row =
        item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : null;
      const values = Array.isArray(row?.value) ? row.value : [];
      const firstValue = values.length > 0 ? Number(values[0]) : 0;
      return sum + (Number.isFinite(firstValue) ? firstValue : 0);
    }, 0);

    return Number((total / timelineData.length).toFixed(2));
  }

  private extractRelatedSignals(
    rawPayload: unknown,
    parentKeyword: string,
    stage: TrendSeedStage
  ): GoogleTrendSignal[] {
    const payload =
      rawPayload && typeof rawPayload === 'object'
        ? (rawPayload as Record<string, unknown>)
        : null;
    const defaultData =
      payload?.default && typeof payload.default === 'object'
        ? (payload.default as Record<string, unknown>)
        : null;
    const rankedList = Array.isArray(defaultData?.rankedList)
      ? defaultData.rankedList
      : [];

    const signals: GoogleTrendSignal[] = [];

    for (const listItem of rankedList) {
      const rankedKeyword =
        listItem && typeof listItem === 'object'
          ? (listItem as Record<string, unknown>).rankedKeyword
          : null;

      if (!Array.isArray(rankedKeyword)) {
        continue;
      }

      for (const keywordEntry of rankedKeyword.slice(0, 5)) {
        const row =
          keywordEntry && typeof keywordEntry === 'object'
            ? (keywordEntry as Record<string, unknown>)
            : null;

        const query = typeof row?.query === 'string' ? row.query.trim() : '';
        if (!query) {
          continue;
        }

        const numericValue = Number(row?.value);
        const score = Number.isFinite(numericValue) ? numericValue : 0;

        signals.push({
          keyword: query,
          score,
          source: 'related_query',
          stage,
          parentKeyword
        });
      }
    }

    return signals;
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private readNullableString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.readString(value);
  }

  private extractProductsFromUnknown(
    unknownProducts: unknown[]
  ): ProductCardOutputItem[] {
    const products: ProductCardOutputItem[] = [];

    for (const unknownItem of unknownProducts) {
      const item =
        unknownItem && typeof unknownItem === 'object'
          ? (unknownItem as Record<string, unknown>)
          : null;

      if (!item) {
        continue;
      }

      const id = this.readString(item.id);
      const name = this.readString(item.name);
      const brandName = this.readString(item.brandName) ?? 'Unknown';
      const rawVariants = Array.isArray(item.variants) ? item.variants : [];

      const variants: ProductCardVariantOutput[] = [];
      for (const rawVariant of rawVariants) {
        const variant =
          rawVariant && typeof rawVariant === 'object'
            ? (rawVariant as Record<string, unknown>)
            : null;

        if (!variant) {
          continue;
        }

        const variantId = this.readString(variant.id);
        const sku = this.readString(variant.sku);
        const volumeMl = Number(variant.volumeMl);
        const basePrice = Number(variant.basePrice);

        if (
          !variantId ||
          !sku ||
          !Number.isFinite(volumeMl) ||
          !Number.isFinite(basePrice)
        ) {
          continue;
        }

        variants.push({
          id: variantId,
          sku,
          volumeMl,
          basePrice
        });
      }

      if (!id || !name || variants.length === 0) {
        continue;
      }

      products.push({
        id,
        name,
        brandName,
        primaryImage: this.readNullableString(item.primaryImage),
        variants
      });
    }

    return products;
  }

  private async getVariantSalesSignalMap(
    variantIds: Set<string>
  ): Promise<Map<string, VariantSalesSignal>> {
    const salesSignalMap = new Map<string, VariantSalesSignal>();

    if (variantIds.size === 0) {
      return salesSignalMap;
    }

    const analyticsResult = await this.restockService.getProductSalesAnalyticsForRestock();
    if (!analyticsResult.success || !analyticsResult.payload) {
      this.logger.warn('[Trend][Rank] Cannot load sales analytics for variant ranking.');
      return salesSignalMap;
    }

    for (const variant of analyticsResult.payload) {
      if (!variantIds.has(variant.variantId)) {
        continue;
      }

      salesSignalMap.set(variant.variantId, {
        last30DaysSales: variant.salesMetrics?.last30DaysSales ?? -1,
        totalQuantitySold: variant.totalQuantitySold ?? -1
      });
    }

    return salesSignalMap;
  }

  private rankVariantsBySalesPriority(
    variants: ProductCardVariantOutput[],
    salesSignalMap: Map<string, VariantSalesSignal>
  ): ProductCardVariantResponse[] {
    return [...variants]
      .sort((left, right) => {
        const leftSignal = salesSignalMap.get(left.id);
        const rightSignal = salesSignalMap.get(right.id);

        const leftLast30 = leftSignal?.last30DaysSales ?? -1;
        const rightLast30 = rightSignal?.last30DaysSales ?? -1;
        if (rightLast30 !== leftLast30) {
          return rightLast30 - leftLast30;
        }

        const leftTotalSold = leftSignal?.totalQuantitySold ?? -1;
        const rightTotalSold = rightSignal?.totalQuantitySold ?? -1;
        if (rightTotalSold !== leftTotalSold) {
          return rightTotalSold - leftTotalSold;
        }

        if (left.basePrice !== right.basePrice) {
          return left.basePrice - right.basePrice;
        }

        if (left.volumeMl !== right.volumeMl) {
          return left.volumeMl - right.volumeMl;
        }

        return left.id.localeCompare(right.id);
      })
      .map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        volumeMl: variant.volumeMl,
        basePrice: variant.basePrice
      }));
  }

  private toTrendProductCards(
    products: ProductCardOutputItem[],
    salesSignalMap: Map<string, VariantSalesSignal>
  ): ProductCardResponse[] {
    return products
      .map((product) => {
        const orderedVariants = this.rankVariantsBySalesPriority(
          product.variants,
          salesSignalMap
        );
        const displayVariant = orderedVariants[0];

        if (!displayVariant) {
          return null;
        }

        return {
          id: product.id,
          name: product.name,
          brandName: product.brandName,
          primaryImage: product.primaryImage,
          variants: orderedVariants,
          sizesCount: orderedVariants.length,
          displayPrice: displayVariant.basePrice
        };
      })
      .filter((product): product is ProductCardResponse => product !== null);
  }

  private async collectTrendLogNameSeeds(requestId: string): Promise<string[]> {
    try {
      const trendLogsResult = await this.inventoryService.getLatestTrendLogs(2);
      if (!trendLogsResult.success || !Array.isArray(trendLogsResult.data)) {
        this.logger.warn(
          `[Trend][Seed][TrendLog] requestId=${requestId} status=skip reason=latest-trend-log-unavailable`
        );
        return [];
      }

      const names: string[] = [];
      for (const log of trendLogsResult.data) {
        const parsed = this.safeParseJson<Record<string, unknown>>(log.trendData);
        if (!parsed) {
          continue;
        }

        const rawProducts = Array.isArray(parsed.products) ? parsed.products : [];
        for (const rawProduct of rawProducts) {
          const product =
            rawProduct && typeof rawProduct === 'object'
              ? (rawProduct as Record<string, unknown>)
              : null;

          const name = this.readString(product?.name);
          if (name) {
            names.push(name);
          }
        }
      }

      const normalizedNames = this.uniqueKeywords(names, 5);
      this.logger.log(
        `[Trend][Seed][TrendLog] requestId=${requestId} extractedNameCount=${normalizedNames.length}`
      );
      return normalizedNames;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.warn(
        `[Trend][Seed][TrendLog] requestId=${requestId} status=error error=${errorMessage}`
      );
      return [];
    }
  }

  private buildSeedKeywords(dynamicNameSeeds: string[]): TrendSeedKeyword[] {
    const defaultNameSeeds = [
      'Dior Sauvage',
      'Bleu de Chanel',
      'YSL Libre',
      'Baccarat Rouge 540',
      'Good Girl Carolina Herrera'
    ];

    const nameKeywords = this.uniqueKeywords(
      [...dynamicNameSeeds, ...defaultNameSeeds],
      6
    ).map((keyword) => ({ keyword, stage: 'name' as const }));

    const attributeKeywords = this.uniqueKeywords(
      [
        'fresh perfume',
        'woody perfume',
        'floral perfume',
        'long lasting perfume',
        'summer perfume',
        'winter perfume'
      ],
      6
    ).map((keyword) => ({ keyword, stage: 'attribute' as const }));

    return [...nameKeywords, ...attributeKeywords];
  }

  private async fetchGoogleSignals(
    requestId: string,
    seedKeywords: TrendSeedKeyword[],
    startDate: Date,
    endDate: Date
  ): Promise<GoogleTrendSignal[]> {
    const startedAt = Date.now();
    this.logger.log(
      `[Trend][GoogleFetch][START] requestId=${requestId} keywordCount=${seedKeywords.length} startDate=${startDate.toISOString()} endDate=${endDate.toISOString()} geo=${GOOGLE_TREND_GEO}`
    );

    const signals: GoogleTrendSignal[] = [];

    for (const seed of seedKeywords) {
      const interestRaw = await this.executeWithRetry(
        requestId,
        'interest_over_time',
        seed.keyword,
        () =>
          googleTrends.interestOverTime({
            keyword: seed.keyword,
            startTime: startDate,
            endTime: endDate,
            geo: GOOGLE_TREND_GEO
          })
      );

      if (interestRaw) {
        const score = this.extractInterestScore(this.safeParseJson(interestRaw));
        signals.push({
          keyword: seed.keyword,
          score,
          source: 'interest_over_time',
          stage: seed.stage
        });
      }

      if (seed.stage !== 'name') {
        continue;
      }

      const relatedRaw = await this.executeWithRetry(
        requestId,
        'related_queries',
        seed.keyword,
        () =>
          googleTrends.relatedQueries({
            keyword: seed.keyword,
            startTime: startDate,
            endTime: endDate,
            geo: GOOGLE_TREND_GEO
          })
      );

      if (!relatedRaw) {
        continue;
      }

      signals.push(
        ...this.extractRelatedSignals(
          this.safeParseJson(relatedRaw),
          seed.keyword,
          seed.stage
        )
      );
    }

    this.logger.log(
      `[Trend][GoogleFetch][DONE] requestId=${requestId} signalCount=${signals.length} durationMs=${Date.now() - startedAt}`
    );

    return signals;
  }

  private buildKeywordFallback(
    requestId: string,
    seedKeywords: TrendSeedKeyword[],
    signals: GoogleTrendSignal[]
  ): TrendKeywordMapperResult {
    const nameSignalKeywords = signals
      .filter((signal) => signal.stage === 'name')
      .sort((left, right) => right.score - left.score)
      .map((signal) => signal.keyword);

    const attributeSignalKeywords = signals
      .filter((signal) => signal.stage === 'attribute' || signal.source === 'related_query')
      .sort((left, right) => right.score - left.score)
      .map((signal) => signal.keyword);

    const seedNameKeywords = seedKeywords
      .filter((seed) => seed.stage === 'name')
      .map((seed) => seed.keyword);

    const seedAttributeKeywords = seedKeywords
      .filter((seed) => seed.stage === 'attribute')
      .map((seed) => seed.keyword);

    const primaryKeywords = this.uniqueKeywords(
      [...nameSignalKeywords, ...seedNameKeywords],
      5
    );

    const expansionKeywords = this.uniqueKeywords(
      [...attributeSignalKeywords, ...seedAttributeKeywords],
      8
    );

    this.logger.warn(
      `[Trend][KeywordMap][FALLBACK] requestId=${requestId} primaryCount=${primaryKeywords.length} expansionCount=${expansionKeywords.length}`
    );

    return {
      primaryKeywords,
      expansionKeywords,
      negativeTerms: ['gift', 'sample', 'mini'],
      confidence: 0.35,
      explanation:
        'Fallback keyword mapper was used because AI output was unavailable or invalid.'
    };
  }

  private async mapGoogleSignalsToKeywords(
    requestId: string,
    seedKeywords: TrendSeedKeyword[],
    signals: GoogleTrendSignal[]
  ): Promise<TrendKeywordMapperResult> {
    const startedAt = Date.now();
    this.logger.log(
      `[Trend][KeywordMap][START] requestId=${requestId} signalCount=${signals.length}`
    );

    const compactSignals = signals
      .sort((left, right) => right.score - left.score)
      .slice(0, GOOGLE_SIGNAL_PROMPT_LIMIT)
      .map((signal) => ({
        keyword: signal.keyword,
        score: signal.score,
        source: signal.source,
        stage: signal.stage,
        parentKeyword: signal.parentKeyword ?? null
      }));

    const mapperPrompt = [
      'You are a keyword planner for perfume trend product search.',
      'Task: transform Google Trends signals into searchable product keywords.',
      'Rules:',
      '1) Keep perfume-name and brand keywords as primary keywords.',
      '2) Put note/family/season style terms into expansion keywords.',
      '3) Return concise keyword phrases only, no explanations inside arrays.',
      '4) negativeTerms should contain noisy words that should be excluded.',
      '',
      `Seed keywords: ${JSON.stringify(seedKeywords)}`,
      `Google signals: ${JSON.stringify(compactSignals)}`
    ].join('\n');

    const mapperSystemPrompt = [
      'Return valid JSON matching the schema exactly.',
      'Do not call tools.',
      'Keep output focused on perfume product search keywords.'
    ].join('\n');

    const adminPrompt =
      await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_TREND);

    try {
      const mapperResponse = await this.aiHelper.textGenerateFromPrompt(
        mapperPrompt,
        `${mapperSystemPrompt}\n${adminPrompt}`,
        Output.object({ schema: trendKeywordMapperSchema }),
        'Failed to map trend keywords'
      );

      if (!mapperResponse.success || !mapperResponse.data) {
        return this.buildKeywordFallback(requestId, seedKeywords, signals);
      }

      const rawData =
        typeof mapperResponse.data === 'string'
          ? this.safeParseJson(mapperResponse.data)
          : mapperResponse.data;

      const parsed = trendKeywordMapperSchema.safeParse(rawData);
      if (!parsed.success) {
        this.logger.warn(
          `[Trend][KeywordMap][FAIL] requestId=${requestId} reason=schema-validation-error issueCount=${parsed.error.issues.length}`
        );
        return this.buildKeywordFallback(requestId, seedKeywords, signals);
      }

      const normalized: TrendKeywordMapperResult = {
        primaryKeywords: this.uniqueKeywords(parsed.data.primaryKeywords, 6),
        expansionKeywords: this.uniqueKeywords(parsed.data.expansionKeywords, 8),
        negativeTerms: this.uniqueKeywords(parsed.data.negativeTerms, 8),
        confidence: parsed.data.confidence,
        explanation: parsed.data.explanation
      };

      this.logger.log(
        `[Trend][KeywordMap][DONE] requestId=${requestId} primaryCount=${normalized.primaryKeywords.length} expansionCount=${normalized.expansionKeywords.length} confidence=${normalized.confidence.toFixed(2)} durationMs=${Date.now() - startedAt}`
      );

      return normalized;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);

      this.logger.warn(
        `[Trend][KeywordMap][FAIL] requestId=${requestId} reason=exception error=${errorMessage}`
      );

      return this.buildKeywordFallback(requestId, seedKeywords, signals);
    }
  }

  private buildQueryKeywordList(mapperResult: TrendKeywordMapperResult): string[] {
    const negatives = new Set(
      mapperResult.negativeTerms.map((term) => term.toLowerCase())
    );

    const mergedKeywords = this.uniqueKeywords(
      [...mapperResult.primaryKeywords, ...mapperResult.expansionKeywords],
      TREND_SEARCH_KEYWORD_LIMIT
    );

    return mergedKeywords.filter((keyword) => !negatives.has(keyword.toLowerCase()));
  }

  private async queryProductsByKeywords(
    requestId: string,
    keywords: string[]
  ): Promise<ProductWithVariantsResponse[]> {
    const startedAt = Date.now();
    this.logger.log(
      `[Trend][ProductQuery][START] requestId=${requestId} keywordCount=${keywords.length}`
    );

    const aggregatedProducts: ProductWithVariantsResponse[] = [];
    const queryRequest: PagedAndSortedRequest = {
      PageNumber: 1,
      PageSize: TREND_SEARCH_PAGE_SIZE,
      SortOrder: 'desc',
      IsDescending: true
    };

    for (const keyword of keywords) {
      const keywordStart = Date.now();
      let keywordProducts: ProductWithVariantsResponse[] = [];

      try {
        const aiSearchResult = await this.productService.getProductsUsingAiSearch(
          keyword,
          queryRequest
        );

        keywordProducts = aiSearchResult.success
          ? aiSearchResult.payload?.items ?? []
          : [];

        this.logger.log(
          `[Trend][ProductQuery][AI] requestId=${requestId} keyword="${keyword}" resultCount=${keywordProducts.length} durationMs=${Date.now() - keywordStart}`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : JSON.stringify(error);

        this.logger.warn(
          `[Trend][ProductQuery][AI][FAIL] requestId=${requestId} keyword="${keyword}" error=${errorMessage}`
        );
      }

      if (keywordProducts.length === 0) {
        const semanticStartedAt = Date.now();
        try {
          const semanticSearchResult =
            await this.productService.getProductsUsingSemanticSearch(
              keyword,
              queryRequest
            );

          keywordProducts = semanticSearchResult.success
            ? semanticSearchResult.payload?.items ?? []
            : [];

          this.logger.log(
            `[Trend][ProductQuery][SEMANTIC] requestId=${requestId} keyword="${keyword}" resultCount=${keywordProducts.length} durationMs=${Date.now() - semanticStartedAt}`
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : JSON.stringify(error);

          this.logger.warn(
            `[Trend][ProductQuery][SEMANTIC][FAIL] requestId=${requestId} keyword="${keyword}" error=${errorMessage}`
          );
        }
      }

      aggregatedProducts.push(...keywordProducts);

      if (aggregatedProducts.length >= TREND_PRODUCT_LIMIT * 4) {
        break;
      }
    }

    this.logger.log(
      `[Trend][ProductQuery][DONE] requestId=${requestId} rawProductCount=${aggregatedProducts.length} durationMs=${Date.now() - startedAt}`
    );

    return aggregatedProducts;
  }

  private dedupeProductsById(
    products: ProductWithVariantsResponse[]
  ): ProductWithVariantsResponse[] {
    const dedupeMap = new Map<string, ProductWithVariantsResponse>();
    for (const product of products) {
      if (!dedupeMap.has(product.id)) {
        dedupeMap.set(product.id, product);
      }
    }
    return Array.from(dedupeMap.values());
  }

  private toProductOutputItems(
    products: ProductWithVariantsResponse[]
  ): ProductCardOutputItem[] {
    return products
      .map((product) => {
        const variants = Array.isArray(product.variants)
          ? product.variants
            .map((variant) => ({
              id: variant.id,
              sku: variant.sku,
              volumeMl: Number(variant.volumeMl),
              basePrice: Number(variant.basePrice)
            }))
            .filter(
              (variant) =>
                variant.id &&
                variant.sku &&
                Number.isFinite(variant.volumeMl) &&
                Number.isFinite(variant.basePrice)
            )
          : [];

        if (variants.length === 0) {
          return null;
        }

        return {
          id: product.id,
          name: product.name,
          brandName: product.brandName,
          primaryImage: product.primaryImage,
          variants
        };
      })
      .filter((product): product is ProductCardOutputItem => product !== null);
  }

  private async toRankedProductCards(
    products: ProductCardOutputItem[]
  ): Promise<ProductCardResponse[]> {
    const variantIds = new Set(
      products.flatMap((product) =>
        product.variants.map((variant) => variant.id)
      )
    );

    const salesSignalMap = await this.getVariantSalesSignalMap(variantIds);
    return this.toTrendProductCards(products, salesSignalMap).slice(
      0,
      TREND_PRODUCT_LIMIT
    );
  }

  private async readCachedTrendProducts(
    requestId: string,
    cacheKey: string
  ): Promise<ProductCardResponse[]> {
    try {
      const cachedData = await this.cacheManager.get<TrendProductsCachePayload>(
        cacheKey
      );
      const cachedProducts = Array.isArray(cachedData?.products)
        ? cachedData.products
        : [];

      if (cachedProducts.length > 0) {
        this.logger.log(
          `[Trend][Cache][HIT] requestId=${requestId} cacheKey=${cacheKey} productCount=${cachedProducts.length}`
        );
        return cachedProducts;
      }

      this.logger.log(
        `[Trend][Cache][MISS] requestId=${requestId} cacheKey=${cacheKey}`
      );
      return [];
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.warn(
        `[Trend][Cache][ERROR] requestId=${requestId} cacheKey=${cacheKey} error=${errorMessage}`
      );
      return [];
    }
  }

  private async writeCachedTrendProducts(
    requestId: string,
    cacheKey: string,
    payload: TrendProductsCachePayload
  ): Promise<void> {
    try {
      await this.cacheManager.set(cacheKey, payload, CACHE_TTL_1WEEK);
      this.logger.log(
        `[Trend][Cache][SET] requestId=${requestId} cacheKey=${cacheKey} productCount=${payload.products.length} ttlMs=${CACHE_TTL_1WEEK}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);

      this.logger.warn(
        `[Trend][Cache][ERROR] requestId=${requestId} cacheKey=${cacheKey} action=set error=${errorMessage}`
      );
    }
  }

  private async extractProductsFromSnapshot(
    requestId: string,
    snapshot: Record<string, unknown>
  ): Promise<ProductCardOutputItem[]> {
    const products = Array.isArray(snapshot.products)
      ? this.extractProductsFromUnknown(snapshot.products)
      : [];

    if (products.length > 0) {
      return products;
    }

    const productTemp = Array.isArray(snapshot.productTemp)
      ? snapshot.productTemp
      : [];

    const ids = this.uniqueKeywords(
      productTemp
        .map((item) => {
          const row =
            item && typeof item === 'object'
              ? (item as Record<string, unknown>)
              : null;
          return this.readString(row?.id);
        })
        .filter((id): id is string => Boolean(id)),
      20
    );

    if (ids.length === 0) {
      return [];
    }

    this.logger.log(
      `[Trend][TrendLogFallback][HYDRATE] requestId=${requestId} productTempIdCount=${ids.length}`
    );

    const hydratedProducts = await this.productService.getProductsByIdsForOutput(ids);
    if (!hydratedProducts.success || !Array.isArray(hydratedProducts.data)) {
      return [];
    }

    return hydratedProducts.data;
  }

  private async getTrendProductsFromLatestLogs(
    requestId: string
  ): Promise<ProductCardResponse[]> {
    try {
      const trendLogsResult = await this.inventoryService.getLatestTrendLogs(
        FALLBACK_TREND_LOG_COUNT
      );

      if (!trendLogsResult.success || !Array.isArray(trendLogsResult.data)) {
        this.logger.warn(
          `[Trend][TrendLogFallback][MISS] requestId=${requestId} reason=no-logs`
        );
        return [];
      }

      for (const log of trendLogsResult.data) {
        const snapshot = this.safeParseJson<Record<string, unknown>>(log.trendData);
        if (!snapshot) {
          continue;
        }

        const products = await this.extractProductsFromSnapshot(requestId, snapshot);
        if (products.length === 0) {
          continue;
        }

        const rankedProducts = await this.toRankedProductCards(products);
        if (rankedProducts.length > 0) {
          this.logger.log(
            `[Trend][TrendLogFallback][HIT] requestId=${requestId} productCount=${rankedProducts.length}`
          );
          return rankedProducts;
        }
      }

      this.logger.warn(
        `[Trend][TrendLogFallback][MISS] requestId=${requestId} reason=no-valid-products`
      );
      return [];
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.warn(
        `[Trend][TrendLogFallback][ERROR] requestId=${requestId} error=${errorMessage}`
      );
      return [];
    }
  }

  private async persistTrendSnapshot(
    requestId: string,
    payload: TrendProductsCachePayload
  ): Promise<void> {
    try {
      await this.inventoryService.saveTrendLog(JSON.stringify(payload));
      this.logger.log(
        `[Trend][Persist][DONE] requestId=${requestId} payloadSize=${JSON.stringify(payload).length}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.warn(
        `[Trend][Persist][ERROR] requestId=${requestId} error=${errorMessage}`
      );
    }
  }

  private async buildLiveTrendPipeline(
    requestId: string,
    allUserLogRequest: AllUserLogRequest
  ): Promise<TrendPipelineResult> {
    const range = this.resolveDateRange(allUserLogRequest);
    const dynamicNameSeeds = await this.collectTrendLogNameSeeds(requestId);
    const seedKeywords = this.buildSeedKeywords(dynamicNameSeeds);

    const googleSignals = await this.fetchGoogleSignals(
      requestId,
      seedKeywords,
      range.startDate,
      range.endDate
    );

    const mapperResult = await this.mapGoogleSignalsToKeywords(
      requestId,
      seedKeywords,
      googleSignals
    );

    const queryKeywords = this.buildQueryKeywordList(mapperResult);
    this.logger.log(
      `[Trend][KeywordMap][RESULT] requestId=${requestId} queryKeywordCount=${queryKeywords.length} keywords=${JSON.stringify(queryKeywords)}`
    );

    const rawProducts = await this.queryProductsByKeywords(requestId, queryKeywords);
    const dedupedProducts = this.dedupeProductsById(rawProducts);
    const productOutputItems = this.toProductOutputItems(dedupedProducts);
    const rankedProducts = await this.toRankedProductCards(productOutputItems);

    this.logger.log(
      `[Trend][MergeRank] requestId=${requestId} rawProductCount=${rawProducts.length} dedupedCount=${dedupedProducts.length} rankedCount=${rankedProducts.length}`
    );

    return {
      products: rankedProducts,
      keywordsUsed: queryKeywords,
      sourceUsed: 'live-google',
      fallbackTier: 'none',
      googleSignals,
      mapperResult
    };
  }

  private async resolveTrendPipeline(
    requestId: string,
    allUserLogRequest: AllUserLogRequest
  ): Promise<TrendPipelineResult> {
    const startedAt = Date.now();
    const cacheKey = this.createCacheKey(allUserLogRequest);
    const forceRefresh = this.getForceRefreshFlag(allUserLogRequest);

    this.logger.log(
      `[Trend][ENTRY] requestId=${requestId} period=${String(allUserLogRequest.period ?? 'monthly')} forceRefresh=${forceRefresh} cacheKey=${cacheKey}`
    );

    if (!forceRefresh) {
      const warmCacheProducts = await this.readCachedTrendProducts(requestId, cacheKey);
      if (warmCacheProducts.length > 0) {
        this.logger.log(
          `[Trend][EXIT] requestId=${requestId} source=cache fallbackTier=cache productCount=${warmCacheProducts.length} durationMs=${Date.now() - startedAt}`
        );

        return {
          products: warmCacheProducts,
          keywordsUsed: [],
          sourceUsed: 'cache',
          fallbackTier: 'cache',
          googleSignals: [],
          mapperResult: emptyMapperResult
        };
      }
    }

    try {
      const liveResult = await this.buildLiveTrendPipeline(
        requestId,
        allUserLogRequest
      );

      if (liveResult.products.length === 0) {
        throw new Error('No products generated from live Google trend pipeline');
      }

      const cachePayload: TrendProductsCachePayload = {
        version: 'trend-v2',
        generatedAt: new Date().toISOString(),
        products: liveResult.products,
        keywordsUsed: liveResult.keywordsUsed,
        sourceUsed: liveResult.sourceUsed,
        fallbackTier: liveResult.fallbackTier,
        googleSignals: liveResult.googleSignals,
        mapperResult: liveResult.mapperResult
      };

      await this.writeCachedTrendProducts(requestId, cacheKey, cachePayload);
      await this.persistTrendSnapshot(requestId, cachePayload);

      this.logger.log(
        `[Trend][EXIT] requestId=${requestId} source=live-google fallbackTier=none productCount=${liveResult.products.length} durationMs=${Date.now() - startedAt}`
      );

      return liveResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);

      this.logger.warn(
        `[Trend][LIVE_FAIL] requestId=${requestId} error=${errorMessage}`
      );

      const cachedProducts = await this.readCachedTrendProducts(requestId, cacheKey);
      if (cachedProducts.length > 0) {
        this.logger.log(
          `[Trend][EXIT] requestId=${requestId} source=cache fallbackTier=cache productCount=${cachedProducts.length} durationMs=${Date.now() - startedAt}`
        );

        return {
          products: cachedProducts,
          keywordsUsed: [],
          sourceUsed: 'cache',
          fallbackTier: 'cache',
          googleSignals: [],
          mapperResult: emptyMapperResult
        };
      }

      const trendLogProducts = await this.getTrendProductsFromLatestLogs(requestId);
      if (trendLogProducts.length > 0) {
        this.logger.log(
          `[Trend][EXIT] requestId=${requestId} source=trend-log fallbackTier=trend-log productCount=${trendLogProducts.length} durationMs=${Date.now() - startedAt}`
        );

        return {
          products: trendLogProducts,
          keywordsUsed: [],
          sourceUsed: 'trend-log',
          fallbackTier: 'trend-log',
          googleSignals: [],
          mapperResult: emptyMapperResult
        };
      }

      this.logger.warn(
        `[Trend][EXIT] requestId=${requestId} source=empty fallbackTier=empty productCount=0 durationMs=${Date.now() - startedAt}`
      );

      return {
        products: [],
        keywordsUsed: [],
        sourceUsed: 'empty',
        fallbackTier: 'empty',
        googleSignals: [],
        mapperResult: emptyMapperResult
      };
    }
  }

  async generateTrendSummary(
    allUserLogRequest: AllUserLogRequest,
    _output?: unknown
  ): Promise<BaseResponse<string>> {
    const requestId = this.createRequestId('trend-summary');
    const result = await this.resolveTrendPipeline(requestId, allUserLogRequest);

    const summaryPayload = {
      message: 'Trend summary generated from Google Trends pipeline.',
      sourceUsed: result.sourceUsed,
      fallbackTier: result.fallbackTier,
      keywordCount: result.keywordsUsed.length,
      keywordsUsed: result.keywordsUsed,
      mapperConfidence: result.mapperResult.confidence,
      generatedAt: new Date().toISOString(),
      products: result.products
    };

    return Ok(JSON.stringify(summaryPayload));
  }

  async getTrendProducts(
    allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<ProductCardResponse[]>> {
    const requestId = this.createRequestId('trend-product');
    const result = await this.resolveTrendPipeline(requestId, allUserLogRequest);

    const attachResult = await this.aiAcceptanceService.createAndAttachAIAcceptanceToProducts({
      contextType: 'trend',
      sourceRefId: requestId,
      products: result.products,
      metadata: {
        sourceUsed: result.sourceUsed,
        fallbackTier: result.fallbackTier,
        keywordCount: result.keywordsUsed.length
      }
    });

    return Ok(attachResult.products as ProductCardResponse[]);
  }

  async generateStructuredTrendForecast(
    allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<AITrendForecastStructuredResponse>> {
    const startedAt = Date.now();
    const requestId = this.createRequestId('trend-structured');
    const result = await this.resolveTrendPipeline(requestId, allUserLogRequest);

    const forecast = [
      `Source used: ${result.sourceUsed}.`,
      `Fallback tier: ${result.fallbackTier}.`,
      `Products generated: ${result.products.length}.`,
      result.keywordsUsed.length > 0
        ? `Keywords: ${result.keywordsUsed.join(', ')}.`
        : 'Keywords: unavailable (fallback path).',
      `Mapper confidence: ${result.mapperResult.confidence.toFixed(2)}.`
    ].join(' ');

    return Ok(
      new AITrendForecastStructuredResponse({
        forecast,
        period: String(allUserLogRequest.period ?? 'custom'),
        analyzedLogCount: result.googleSignals.length,
        generatedAt: new Date(),
        metadata: new AIResponseMetadata({
          processingTimeMs: Date.now() - startedAt
        })
      })
    );
  }
}
