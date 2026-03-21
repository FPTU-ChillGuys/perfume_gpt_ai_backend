import { Injectable } from '@nestjs/common';
import { ZodObject } from 'zod';
import { AllUserLogRequest } from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import {
  AITrendForecastStructuredResponse,
  AIResponseMetadata
} from 'src/application/dtos/response/ai-structured.response';
import { ProductResponse } from 'src/application/dtos/response/product.response';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { TrendNarrativeHelper } from '../helpers/trend-narrative.helper';
import { TrendMapper, RankedTrendItem, REASON_CODE_DESCRIPTION } from '../mappers/trend.mapper';
import { InventoryService } from './inventory.service';
import { ProductService } from './product.service';
import { RestockService } from './restock.service';
import { UserLogService } from './user-log.service';
import {
  calculateTrendScore,
  SalesTrend,
  SalesVolatility
} from '../utils/trend-scoring.util';
import { ProductWithVariantsResponse } from 'src/application/dtos/response/product-with-variants.response';

@Injectable()
export class TrendService {
  constructor(
    private readonly trendNarrativeHelper: TrendNarrativeHelper,
    private readonly inventoryService: InventoryService,
    private readonly productService: ProductService,
    private readonly restockService: RestockService,
    private readonly userLogService: UserLogService
  ) {}

  private buildSnapshotText(trendLogs: Array<{ trendData: string }>): string {
    return trendLogs
      .map((log) => (log?.trendData ?? '').toLowerCase())
      .join(' ');
  }

  private toPeriodEnum(period?: PeriodEnum): PeriodEnum {
    if (period === PeriodEnum.WEEKLY || period === PeriodEnum.YEARLY) {
      return period;
    }

    return PeriodEnum.MONTHLY;
  }

  private detectDominantTrend(
    values: Array<{ trend: SalesTrend; volatility: SalesVolatility }>
  ): { salesTrend: SalesTrend; volatility: SalesVolatility } {
    if (values.length === 0) {
      return { salesTrend: 'STABLE', volatility: 'LOW' };
    }

    const trendCount = new Map<SalesTrend, number>([
      ['INCREASING', 0],
      ['STABLE', 0],
      ['DECLINING', 0]
    ]);
    const volatilityCount = new Map<SalesVolatility, number>([
      ['LOW', 0],
      ['MEDIUM', 0],
      ['HIGH', 0]
    ]);

    for (const value of values) {
      trendCount.set(value.trend, (trendCount.get(value.trend) ?? 0) + 1);
      volatilityCount.set(
        value.volatility,
        (volatilityCount.get(value.volatility) ?? 0) + 1
      );
    }

    const salesTrend = Array.from(trendCount.entries()).sort((a, b) => b[1] - a[1])[0][0];
    const volatility = Array.from(volatilityCount.entries()).sort((a, b) => b[1] - a[1])[0][0];

    return { salesTrend, volatility };
  }

  private async buildRankedTrendItems(
    allUserLogRequest: AllUserLogRequest
  ): Promise<{ rankedItems: RankedTrendItem[]; analyzedLogCount: number }> {
    const period = this.toPeriodEnum(allUserLogRequest.period);

    const [bestSellingResponse, newestResponse, salesAnalyticsResponse, logsResponse, trendLogsResponse] =
      await Promise.all([
        this.productService.getBestSellingProducts({
          PageNumber: 1,
          PageSize: 10,
          SortOrder: 'desc',
          IsDescending: true
        }),
        this.productService.getNewestProductsWithVariants({
          PageNumber: 1,
          PageSize: 10,
          SortOrder: 'desc',
          IsDescending: true
        }),
        this.restockService.getProductSalesAnalyticsForRestock(),
        this.userLogService.getAllSummaryByPeriod(period),
        this.inventoryService.getLatestTrendLogs(2)
      ]);

    const bestSellingItems = bestSellingResponse.success
      ? bestSellingResponse.data?.items ?? []
      : [];
    const newestItems = newestResponse.success ? newestResponse.data?.items ?? [] : [];
    const salesItems = salesAnalyticsResponse.success
      ? salesAnalyticsResponse.payload ?? []
      : [];
    const logItems = logsResponse.success ? logsResponse.data ?? [] : [];
    const trendLogs = trendLogsResponse.success
      ? (trendLogsResponse.data ?? [])
      : [];

    const analyzedLogCount = logItems.reduce(
      (sum, item) => sum + (item?.totalEvents ?? 0),
      0
    );
    const snapshotText = this.buildSnapshotText(trendLogs);

    const salesMap = new Map(
      salesItems.map((item) => [
        item.variantId,
        {
          last7DaysSales: item.salesMetrics?.last7DaysSales ?? 0,
          last30DaysSales: item.salesMetrics?.last30DaysSales ?? 0,
          trend: (item.salesMetrics?.trend ?? 'STABLE') as SalesTrend,
          volatility: (item.salesMetrics?.volatility ?? 'LOW') as SalesVolatility
        }
      ])
    );

    const candidateMap = new Map<
      string,
      {
        product: ProductWithVariantsResponse;
        isBestSeller: boolean;
        bestSellerRank?: number;
        isNewest: boolean;
        newestRank?: number;
      }
    >();

    bestSellingItems.forEach((item, index) => {
      candidateMap.set(item.product.id, {
        product: item.product,
        isBestSeller: true,
        bestSellerRank: index,
        isNewest: false
      });
    });

    newestItems.forEach((item, index) => {
      const existing = candidateMap.get(item.id);
      if (existing) {
        existing.isNewest = true;
        existing.newestRank = index;
        return;
      }

      candidateMap.set(item.id, {
        product: item,
        isBestSeller: false,
        isNewest: true,
        newestRank: index
      });
    });

    const rankedItems: RankedTrendItem[] = Array.from(candidateMap.entries())
      .map(([productId, candidate]) => {
        const variants = candidate.product.variants ?? [];

        let last7DaysSales = 0;
        let last30DaysSales = 0;
        const trendAndVolatilitySignals: Array<{
          trend: SalesTrend;
          volatility: SalesVolatility;
        }> = [];

        for (const variant of variants) {
          const metrics = salesMap.get(variant.id);
          if (!metrics) {
            continue;
          }

          last7DaysSales += metrics.last7DaysSales;
          last30DaysSales += metrics.last30DaysSales;
          trendAndVolatilitySignals.push({
            trend: metrics.trend,
            volatility: metrics.volatility
          });
        }

        const representativeVariantId = variants.length > 0 ? variants[0].id : null;
        const { salesTrend, volatility } = this.detectDominantTrend(
          trendAndVolatilitySignals
        );
        const snapshotMentioned =
          snapshotText.includes(candidate.product.name.toLowerCase()) ||
          variants.some((variant) => snapshotText.includes((variant.sku ?? '').toLowerCase()));

        const score = calculateTrendScore(
          {
            isBestSeller: candidate.isBestSeller,
            bestSellerRank: candidate.bestSellerRank,
            isNewest: candidate.isNewest,
            newestRank: candidate.newestRank,
            last7DaysSales,
            last30DaysSales,
            salesTrend,
            volatility,
            behaviorTotalEvents: analyzedLogCount,
            snapshotMentioned
          },
          period
        );

        const badgeType: 'Rising' | 'New' | 'Stable' =
          candidate.isNewest && score.trendScore < 75
            ? 'New'
            : score.trendScore >= 75
              ? 'Rising'
              : 'Stable';

        return {
          productId,
          productName: candidate.product.name,
          product: candidate.product,
          representativeVariantId,
          trendScore: score.trendScore,
          confidence: score.confidence,
          badgeType,
          reasonCodes: score.reasonCodes,
          last7DaysSales,
          last30DaysSales
        };
      })
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, 10);

    return { rankedItems, analyzedLogCount };
  }

  /** Dự đoán xu hướng từ tổng hợp log người dùng */
  async generateTrendSummary(
    allUserLogRequest: AllUserLogRequest,
    _output?: ZodObject
  ): Promise<BaseResponse<Record<string, unknown>>> {
    const { rankedItems, analyzedLogCount } =
      await this.buildRankedTrendItems(allUserLogRequest);
    const narrative = await this.trendNarrativeHelper.generateNarrative(
      allUserLogRequest,
      rankedItems,
      analyzedLogCount
    );

    const response = {
      message: narrative,
      products: rankedItems.map((item) =>
        TrendMapper.mapProductToTrendOutputShape(item.product)
      )
    };

    this.inventoryService.saveTrendLog(JSON.stringify(response)).catch((err) => {
      console.error('Failed to save trend log:', err);
    });

    return Ok(response);
  }

  /** Lấy product từ xu hướng người dùng */
  async getTrendProducts(
    allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<ProductResponse[]>> {
    const { rankedItems } = await this.buildRankedTrendItems(allUserLogRequest);
    return Ok(TrendMapper.mapRankedItemsToProductResponse(rankedItems));
  }

  /** Dự đoán xu hướng có cấu trúc với metadata */
  async generateStructuredTrendForecast(
    allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<AITrendForecastStructuredResponse>> {
    const startTime = Date.now();
    const { rankedItems, analyzedLogCount } =
      await this.buildRankedTrendItems(allUserLogRequest);
    const narrative = await this.trendNarrativeHelper.generateNarrative(
      allUserLogRequest,
      rankedItems,
      analyzedLogCount
    );

    const processingTimeMs = Date.now() - startTime;
    const period = this.toPeriodEnum(allUserLogRequest.period);

    return Ok(new AITrendForecastStructuredResponse({
      forecast: narrative,
      trendItems: TrendMapper.mapTrendItemsForStructuredResponse(rankedItems),
      period: period.toString(),
      analyzedLogCount,
      generatedAt: new Date(),
      metadata: new AIResponseMetadata({ processingTimeMs })
    }));
  }

  async getLatestTrendSnapshots(
    limit: number = 5
  ): Promise<BaseResponse<Array<{ createdAt: Date; trendData: string }>>> {
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 20)
      : 5;
    const snapshotsResponse = await this.inventoryService.getLatestTrendLogs(
      safeLimit
    );

    if (!snapshotsResponse.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to fetch latest trend snapshots',
        {
          service: 'InventoryService',
          endpoint: 'TrendService.getLatestTrendSnapshots'
        }
      );
    }

    const snapshots = (snapshotsResponse.data ?? []).map((log) => ({
      createdAt: log.createdAt,
      trendData: log.trendData
    }));

    return Ok(snapshots);
  }
}
