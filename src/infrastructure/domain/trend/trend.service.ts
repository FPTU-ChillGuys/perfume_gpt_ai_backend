import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
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
import { BestSellingProductResponse } from 'src/application/dtos/response/product-insight.response';
import { VariantSalesSignal } from 'src/application/dtos/trend/variant-sales-signal.type';
import { TrendSeedKeyword, TrendSeedStage } from 'src/application/dtos/trend/trend-seed-keyword.type';
import { GoogleTrendSignal } from 'src/application/dtos/trend/google-trend-signal.type';
import { TrendKeywordMapperResult } from 'src/application/dtos/trend/trend-keyword-mapper-result.type';
import { TrendPipelineSource, TrendPipelineResult } from 'src/application/dtos/trend/trend-pipeline-result.type';
import { TrendProductsCachePayload } from 'src/application/dtos/trend/trend-products-cache-payload.type';
import {
  ProductCardOutputItem,
  ProductCardVariantOutput
} from 'src/chatbot/output/product.output';
import { CACHE_TTL_1WEEK } from 'src/infrastructure/domain/common/cacheable/cacheable.constants';
import { InventoryService } from 'src/infrastructure/domain/inventory/inventory.service';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { RestockService } from 'src/infrastructure/domain/restock/restock.service';
import { AIAcceptanceService } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.service';
import { AiAnalysisService } from 'src/infrastructure/domain/ai/ai-analysis.service';
import { TrendHelpersUtil } from 'src/infrastructure/domain/trend/trend-helpers.util';

const TREND_PRODUCT_LIMIT = 15;
const TREND_SEARCH_PAGE_SIZE = 20;
const TREND_SEARCH_KEYWORD_LIMIT = 10;
const TREND_CACHE_PREFIX = 'trend_v2_products';
const GOOGLE_FETCH_TIMEOUT_MS = 12_000;
const GOOGLE_FETCH_RETRY_COUNT = 1;
const GOOGLE_FETCH_RETRY_DELAY_MS = 300;
const GOOGLE_TREND_GEO = 'VN';
const GOOGLE_SIGNAL_PROMPT_LIMIT = 40;
const SIMPLE_TREND_BASE_KEYWORD = 'nước hoa';

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
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly inventoryService: InventoryService,
    private readonly restockService: RestockService,
    private readonly productService: ProductService,
    private readonly aiAcceptanceService: AIAcceptanceService,
    private readonly aiAnalysisService: AiAnalysisService
  ) { }

  private readonly logger = new Logger(TrendService.name);

  private createRequestId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private getForceRefreshFlag(allUserLogRequest: AllUserLogRequest): boolean {
    const rawValue = (allUserLogRequest as { forceRefresh?: unknown }).forceRefresh;
    return rawValue === true || String(rawValue).toLowerCase() === 'true';
  }

  private resolveDateRange(allUserLogRequest: AllUserLogRequest): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    const endDate = TrendHelpersUtil.toValidDate(allUserLogRequest.endDate, now);

    if (allUserLogRequest.startDate) {
      const startDate = TrendHelpersUtil.toValidDate(allUserLogRequest.startDate, subDays(endDate, 30));
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

  private async executeWithRetry<T>(
    requestId: string,
    operationName: string,
    keyword: string,
    operation: () => Promise<T>
  ): Promise<T | null> {
    for (let attempt = 0; attempt <= GOOGLE_FETCH_RETRY_COUNT; attempt++) {
      const startedAt = Date.now();

      try {
        const result = await TrendHelpersUtil.withTimeout(
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
          await TrendHelpersUtil.wait(GOOGLE_FETCH_RETRY_DELAY_MS);
        }
      }
    }

    return null;
  }

  private buildSeedKeywords(): TrendSeedKeyword[] {
    return TrendHelpersUtil.uniqueKeywords([SIMPLE_TREND_BASE_KEYWORD], 1).map(
      (keyword) => ({ keyword, stage: 'name' as const })
    );
  }

  private async fetchRelatedQueries(
    requestId: string,
    seed: TrendSeedKeyword,
    startDate: Date,
    endDate: Date
  ): Promise<GoogleTrendSignal[]> {
    if (seed.stage !== 'name') {
      return [];
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
      return [];
    }

    const relatedRawText =
      typeof relatedRaw === 'string' ? relatedRaw : JSON.stringify(relatedRaw);
    const relatedSignals = TrendHelpersUtil.extractRelatedSignals(
      TrendHelpersUtil.safeParseJson(relatedRaw),
      seed.keyword,
      seed.stage
    );

    this.logger.log(
      `[Trend][GoogleFetch][RAW] requestId=${requestId} operation=related_queries keyword="${seed.keyword}" rawChars=${relatedRawText.length} parsedSignalCount=${relatedSignals.length} preview="${TrendHelpersUtil.truncateForLog(
        relatedSignals
          .slice(0, 8)
          .map((signal) => `${signal.keyword}:${signal.score}`)
          .join(' | '),
        360
      )}"`
    );

    return relatedSignals;
  }

  private async fetchInterestOverTime(
    requestId: string,
    seed: TrendSeedKeyword,
    startDate: Date,
    endDate: Date
  ): Promise<GoogleTrendSignal | null> {
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

    if (!interestRaw) {
      return null;
    }

    const interestRawText =
      typeof interestRaw === 'string' ? interestRaw : JSON.stringify(interestRaw);
    const score = TrendHelpersUtil.extractInterestScore(TrendHelpersUtil.safeParseJson(interestRaw));

    this.logger.log(
      `[Trend][GoogleFetch][RAW] requestId=${requestId} operation=interest_over_time keyword="${seed.keyword}" rawChars=${interestRawText.length} score=${score}`
    );

    return {
      keyword: seed.keyword,
      score,
      source: 'interest_over_time',
      stage: seed.stage
    };
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
      const relatedSignals = await this.fetchRelatedQueries(requestId, seed, startDate, endDate);

      if (relatedSignals.length > 0) {
        signals.push(...relatedSignals);
        continue;
      }

      const interestSignal = await this.fetchInterestOverTime(requestId, seed, startDate, endDate);
      if (interestSignal) {
        signals.push(interestSignal);
      }
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

    const primaryKeywords = TrendHelpersUtil.uniqueKeywords(
      [...nameSignalKeywords, ...seedNameKeywords],
      5
    );

    const expansionKeywords = TrendHelpersUtil.uniqueKeywords(
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
      `[Trend][KeywordMap][START] requestId=${requestId} mode=nlp-only signalCount=${signals.length}`
    );

    const compactSignals = signals
      .sort((left, right) => right.score - left.score)
      .slice(0, GOOGLE_SIGNAL_PROMPT_LIMIT);
    const signalSummary = TrendHelpersUtil.summarizeSignals(compactSignals);

    const mapped = this.buildKeywordFallback(requestId, seedKeywords, compactSignals);

    this.logger.log(
      `[Trend][KeywordMap][DONE] requestId=${requestId} mode=nlp-only primaryCount=${mapped.primaryKeywords.length} expansionCount=${mapped.expansionKeywords.length} confidence=${mapped.confidence.toFixed(2)} durationMs=${Date.now() - startedAt} signalPreview="${signalSummary.preview}"`
    );

    return mapped;
  }

  private buildQueryKeywordList(mapperResult: TrendKeywordMapperResult): string[] {
    const negatives = new Set(
      mapperResult.negativeTerms.map((term) => term.toLowerCase())
    );

    const mergedKeywords = TrendHelpersUtil.uniqueKeywords(
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
        const semanticSearchResult =
          await this.productService.getProductsUsingSemanticSearch(
            keyword,
            queryRequest
          );

        keywordProducts = semanticSearchResult.success
          ? semanticSearchResult.payload?.items ?? []
          : [];

        this.logger.log(
          `[Trend][ProductQuery][NLP] requestId=${requestId} keyword="${keyword}" resultCount=${keywordProducts.length} durationMs=${Date.now() - keywordStart}`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : JSON.stringify(error);

        this.logger.warn(
          `[Trend][ProductQuery][NLP][FAIL] requestId=${requestId} keyword="${keyword}" error=${errorMessage}`
        );
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

        const outputItem: ProductCardOutputItem = {
          id: product.id,
          name: product.name,
          brandName: product.brandName,
          primaryImage: product.primaryImage,
          reasoning: null,
          source: null,
          variants
        };

        return outputItem;
      })
      .filter((product): product is ProductCardOutputItem => product !== null);
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

  private async collectProductsPerSignal(
    requestId: string,
    signals: GoogleTrendSignal[]
  ): Promise<ProductWithVariantsResponse[]> {
    const topSignals = signals
      .sort((a, b) => b.score - a.score)
      .slice(0, GOOGLE_SIGNAL_PROMPT_LIMIT);

    this.logger.log(
      `[Trend][Merge][START] requestId=${requestId} signalCount=${topSignals.length} strategy=per-keyword`
    );

    const allQueryProducts: ProductWithVariantsResponse[] = [];

    for (const signal of topSignals) {
      try {
        const singleAnalysis = await this.aiAnalysisService.analyzeTrend([
          { keyword: signal.keyword, score: signal.score, source: signal.source }
        ]);

        if (!singleAnalysis) {
          this.logger.warn(
            `[Trend][Merge][SKIP] requestId=${requestId} keyword="${signal.keyword}" reason=no-analysis`
          );
          continue;
        }

        const expandedAnalysis = {
          ...singleAnalysis,
          pagination: { pageNumber: 1, pageSize: 10 }
        };

        const searchResponse = await this.productService.getProductsByStructuredQuery(expandedAnalysis);
        const products = searchResponse.success && searchResponse.data
          ? searchResponse.data.items
          : [];

        this.logger.log(
          `[Trend][Merge][KEYWORD] requestId=${requestId} keyword="${signal.keyword}" count=${products.length}`
        );

        allQueryProducts.push(...products);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        this.logger.warn(
          `[Trend][Merge][KEYWORD][FAIL] requestId=${requestId} keyword="${signal.keyword}" error=${errorMessage}`
        );
      }

      if (allQueryProducts.length >= TREND_PRODUCT_LIMIT * 6) {
        this.logger.log(
          `[Trend][Merge][EARLY_EXIT] requestId=${requestId} accumulated=${allQueryProducts.length}`
        );
        break;
      }
    }

    return allQueryProducts;
  }

  private intersectWithBestSellers(
    requestId: string,
    queryProducts: ProductWithVariantsResponse[],
    bestSellerProducts: ProductWithVariantsResponse[]
  ): ProductWithVariantsResponse[] {
    const dedupedQueryProducts = this.dedupeProductsById(queryProducts);

    if (bestSellerProducts.length > 0 && dedupedQueryProducts.length > 0) {
      const queryProductIds = new Set(dedupedQueryProducts.map((p) => p.id));
      const intersection = bestSellerProducts.filter((p) => queryProductIds.has(p.id));
      if (intersection.length > 0) {
        this.logger.log(
          `[Trend][Merge][INTERSECTION] requestId=${requestId} intersectionCount=${intersection.length} — using best seller order`
        );
        return intersection;
      }

      this.logger.log(
        `[Trend][Merge][FALLBACK] requestId=${requestId} dedupedCount=${dedupedQueryProducts.length} — no intersection, fallback to query products`
      );
      return dedupedQueryProducts;
    }

    const used = dedupedQueryProducts.length > 0 ? 'query' : 'bestseller';
    this.logger.log(
      `[Trend][Merge][ONE_SIDE] requestId=${requestId} using=${used}`
    );
    return dedupedQueryProducts.length > 0 ? dedupedQueryProducts : bestSellerProducts;
  }

  private async mergeTrendProducts(
    requestId: string,
    signals: GoogleTrendSignal[]
  ): Promise<ProductCardResponse[]> {
    const startedAt = Date.now();

    const allQueryProducts = await this.collectProductsPerSignal(requestId, signals);

    const bestSellerResponse = await this.productService.getBestSellingProducts({
      PageNumber: 1,
      PageSize: 50,
      SortOrder: 'desc',
      IsDescending: true
    });
    const bestSellerProducts = bestSellerResponse.success && bestSellerResponse.data
      ? bestSellerResponse.data.items.map((item: BestSellingProductResponse) => item.product)
      : [];

    this.logger.log(
      `[Trend][Merge][BESTSELLER] requestId=${requestId} bestSellerCount=${bestSellerProducts.length}`
    );

    const mergedProducts = this.intersectWithBestSellers(requestId, allQueryProducts, bestSellerProducts);

    const productOutputItems = this.toProductOutputItems(
      this.dedupeProductsById(mergedProducts)
    );
    const rankedProducts = await this.toRankedProductCards(productOutputItems);

    this.logger.log(
      `[Trend][Merge][DONE] requestId=${requestId} rawAccumulated=${allQueryProducts.length} deduped=${this.dedupeProductsById(allQueryProducts).length} finalCount=${rankedProducts.length} durationMs=${Date.now() - startedAt}`
    );

    return rankedProducts;
  }


  private async buildLiveTrendPipeline(
    requestId: string,
    allUserLogRequest: AllUserLogRequest
  ): Promise<TrendPipelineResult> {
    const range = this.resolveDateRange(allUserLogRequest);
    const seedKeywords = this.buildSeedKeywords();

    const googleSignals = await this.fetchGoogleSignals(
      requestId,
      seedKeywords,
      range.startDate,
      range.endDate
    );

    let rankedProducts: ProductCardResponse[];
    let mapperResult: TrendKeywordMapperResult;
    let queryKeywords: string[];

    if (googleSignals.length > 0) {
      // New pipeline: per-keyword AI analysis + support merge
      rankedProducts = await this.mergeTrendProducts(requestId, googleSignals);
      mapperResult = {
        primaryKeywords: googleSignals
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
          .map(s => s.keyword),
        expansionKeywords: [],
        negativeTerms: [],
        confidence: 0.85,
        explanation: 'Per-keyword AI analysis used for trend product resolution.'
      };
      queryKeywords = mapperResult.primaryKeywords;
    } else {
      // Fallback: legacy NLP pipeline
      this.logger.warn(
        `[Trend][Pipeline][FALLBACK] requestId=${requestId} No Google signals, falling back to NLP pipeline`
      );
      mapperResult = await this.mapGoogleSignalsToKeywords(requestId, seedKeywords, googleSignals);
      queryKeywords = this.buildQueryKeywordList(mapperResult);
      this.logger.log(
        `[Trend][KeywordMap][RESULT] requestId=${requestId} queryKeywordCount=${queryKeywords.length} keywords=${JSON.stringify(queryKeywords)}`
      );
      const rawProducts = await this.queryProductsByKeywords(requestId, queryKeywords);
      const dedupedProducts = this.dedupeProductsById(rawProducts);
      const productOutputItems = this.toProductOutputItems(dedupedProducts);
      rankedProducts = await this.toRankedProductCards(productOutputItems);
    }

    this.logger.log(
      `[Trend][MergeRank] requestId=${requestId} rankedCount=${rankedProducts.length}`
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


  private makePipelineResult(
    products: ProductCardResponse[],
    sourceUsed: TrendPipelineSource,
    fallbackTier: TrendPipelineResult['fallbackTier'],
    keywordsUsed: string[] = [],
    googleSignals: GoogleTrendSignal[] = [],
    mapperResult: TrendKeywordMapperResult = emptyMapperResult
  ): TrendPipelineResult {
    return {
      products,
      keywordsUsed,
      sourceUsed,
      fallbackTier,
      googleSignals,
      mapperResult
    };
  }

  private async handlePipelineFallback(
    requestId: string,
    cacheKey: string,
    startedAt: number
  ): Promise<TrendPipelineResult> {
    const cachedProducts = await this.readCachedTrendProducts(requestId, cacheKey);
    if (cachedProducts.length > 0) {
      this.logger.log(
        `[Trend][EXIT] requestId=${requestId} source=cache fallbackTier=cache productCount=${cachedProducts.length} durationMs=${Date.now() - startedAt}`
      );
      return this.makePipelineResult(cachedProducts, 'cache', 'cache');
    }

    this.logger.warn(
      `[Trend][EXIT] requestId=${requestId} source=empty fallbackTier=empty productCount=0 durationMs=${Date.now() - startedAt}`
    );
    return this.makePipelineResult([], 'empty', 'empty');
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
        return this.makePipelineResult(warmCacheProducts, 'cache', 'cache');
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

      return this.handlePipelineFallback(requestId, cacheKey, startedAt);
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
