import { Injectable } from '@nestjs/common';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import {
  VariantSalesAnalyticsResponse,
  DailySalesRecord
} from 'src/application/dtos/response/variant-sales-analytics.response';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { calculateSalesMetrics } from 'src/infrastructure/domain/utils/sales-metrics.util';
import { InventoryNatsRepository } from '../repositories/nats/inventory-nats.repository';
import { SalesNatsRepository } from '../repositories/nats/sales-nats.repository';
import {
  RedisInventoryStockResponse,
  VariantSalesAnalyticsRedisResponse
} from 'src/application/dtos/response/redis-internal.response';
import { I18nService } from 'nestjs-i18n';

export interface ProductVariantSalesCandidate {
  variantId: string;
  sku: string;
  volumeMl: number;
  basePrice: number;
  status: string;
  isCriticalStock: boolean;
  totalQuantitySold: number;
  averageDailySales: number;
  last7DaysSales: number;
  last30DaysSales: number;
  trend: 'INCREASING' | 'STABLE' | 'DECLINING';
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ProductSalesAnalyticsCandidate {
  productName: string;
  variantCount: number;
  hasCriticalStock: boolean;
  totalQuantitySold: number;
  averageDailySales: number;
  last7DaysSales: number;
  last30DaysSales: number;
  salesTrend: 'INCREASING' | 'STABLE' | 'DECLINING';
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  variants: ProductVariantSalesCandidate[];
}

/**
 * Service xử lý dữ liệu phân tích bán hàng variant để dự đoán tái cấp hàng
 */
@Injectable()
export class RestockService {
  constructor(
    private readonly inventoryNatsRepo: InventoryNatsRepository,
    private readonly salesNatsRepo: SalesNatsRepository,
    private readonly i18n: I18nService
  ) {}

  private inferAggregateTrend(last7DaysSales: number, last30DaysSales: number): 'INCREASING' | 'STABLE' | 'DECLINING' {
    if (last30DaysSales <= 0) {
      return 'STABLE';
    }

    const baseline = last30DaysSales / 4;
    if (last7DaysSales > baseline * 1.15) {
      return 'INCREASING';
    }
    if (last7DaysSales < baseline * 0.85) {
      return 'DECLINING';
    }
    return 'STABLE';
  }

  private inferAggregateVolatility(values: Array<'LOW' | 'MEDIUM' | 'HIGH'>): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (values.includes('HIGH')) {
      return 'HIGH';
    }
    if (values.includes('MEDIUM')) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private buildProductCandidates(
    variants: VariantSalesAnalyticsResponse[],
    mode: CandidateMode,
    limit: number,
    criticalVariantIds: Set<string> = new Set<string>()
  ): ProductSalesAnalyticsCandidate[] {
    const byProduct = new Map<string, ProductSalesAnalyticsCandidate>();

    for (const variant of variants) {
      const last7DaysSales = variant.salesMetrics?.last7DaysSales ?? 0;
      const last30DaysSales = variant.salesMetrics?.last30DaysSales ?? 0;
      const totalQuantitySold = variant.totalQuantitySold ?? 0;

      const shouldInclude = mode === 'trend'
        ? (last30DaysSales > 0 || totalQuantitySold > 0)
        : (totalQuantitySold > 0 || criticalVariantIds.has(variant.variantId));

      if (!shouldInclude) {
        continue;
      }

      const key = variant.productName;
      const current = byProduct.get(key) ?? {
        productName: variant.productName,
        variantCount: 0,
        hasCriticalStock: false,
        totalQuantitySold: 0,
        averageDailySales: 0,
        last7DaysSales: 0,
        last30DaysSales: 0,
        salesTrend: 'STABLE',
        volatility: 'LOW',
        variants: []
      };

      current.variantCount += 1;
      current.hasCriticalStock =
        current.hasCriticalStock || criticalVariantIds.has(variant.variantId);
      current.totalQuantitySold += totalQuantitySold;
      current.averageDailySales += variant.averageDailySales ?? 0;
      current.last7DaysSales += last7DaysSales;
      current.last30DaysSales += last30DaysSales;
      current.variants.push({
        variantId: variant.variantId,
        sku: variant.sku,
        volumeMl: variant.volumeMl,
        basePrice: variant.basePrice,
        status: variant.status,
        isCriticalStock: criticalVariantIds.has(variant.variantId),
        totalQuantitySold,
        averageDailySales: variant.averageDailySales ?? 0,
        last7DaysSales,
        last30DaysSales,
        trend: variant.salesMetrics?.trend ?? 'STABLE',
        volatility: variant.salesMetrics?.volatility ?? 'LOW'
      });

      byProduct.set(key, current);
    }

    const candidates = Array.from(byProduct.values()).map((item) => {
      item.salesTrend = this.inferAggregateTrend(item.last7DaysSales, item.last30DaysSales);
      item.volatility = this.inferAggregateVolatility(item.variants.map((variant) => variant.volatility));
      item.averageDailySales = Number(item.averageDailySales.toFixed(2));
      item.variants.sort((left, right) => {
        if (right.last30DaysSales !== left.last30DaysSales) {
          return right.last30DaysSales - left.last30DaysSales;
        }
        if (right.totalQuantitySold !== left.totalQuantitySold) {
          return right.totalQuantitySold - left.totalQuantitySold;
        }
        return left.basePrice - right.basePrice;
      });
      return item;
    });

    if (mode === 'trend') {
      return candidates
        .sort((left, right) => {
          const leftScore = left.last30DaysSales * 2 + left.last7DaysSales * 3 + left.totalQuantitySold;
          const rightScore = right.last30DaysSales * 2 + right.last7DaysSales * 3 + right.totalQuantitySold;
          return rightScore - leftScore;
        })
        .slice(0, limit);
    }

    return candidates
      .sort((left, right) => {
        if (left.hasCriticalStock !== right.hasCriticalStock) {
          return Number(right.hasCriticalStock) - Number(left.hasCriticalStock);
        }
        if (right.totalQuantitySold !== left.totalQuantitySold) {
          return right.totalQuantitySold - left.totalQuantitySold;
        }
        return right.last30DaysSales - left.last30DaysSales;
      })
      .slice(0, Math.max(limit, candidates.filter((item) => item.hasCriticalStock).length));
  }

  private async getCriticalLowStockVariants(
    knownVariantIds: Set<string>
  ): Promise<{ variants: VariantSalesAnalyticsResponse[]; ids: Set<string> }> {
    const response = (await this.inventoryNatsRepo.getPagedStock({
      isLowStock: true,
      pageSize: 200
    })) as { items: RedisInventoryStockResponse[] };

    const items = response?.items || [];
    const ids = new Set<string>();
    const variants: VariantSalesAnalyticsResponse[] = [];
    const now = new Date();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());

    for (const item of items) {
      const variantId = item.variantId;
      ids.add(variantId);
      if (knownVariantIds.has(variantId)) {
        continue;
      }

      variants.push(
        new VariantSalesAnalyticsResponse({
          variantId,
          sku: item.variantSku,
          productName: item.productName,
          volumeMl: item.volumeMl,
          type: item.type,
          basePrice: Number(item.basePrice),
          status: item.variantStatus,
          concentrationName: item.concentrationName,
          dailySalesData: [],
          totalQuantitySold: 0,
          totalRevenue: 0,
          averageDailySales: 0,
          periodStartDate: twoMonthsAgo.toISOString().split('T')[0],
          periodEndDate: now.toISOString().split('T')[0],
          daysWithSalesCount: 0,
          salesMetrics: {
            last7DaysSales: 0,
            last30DaysSales: 0,
            trend: 'STABLE',
            volatility: 'LOW',
            encodedData: null
          }
        })
      );
    }

    return { variants, ids };
  }

  async getProductSalesAnalyticsForTrendCandidates(
    limit = 15
  ): Promise<BaseResponseAPI<ProductSalesAnalyticsCandidate[]>> {
    const analyticsResult = await this.getProductSalesAnalyticsForRestock();
    if (!analyticsResult.success || !analyticsResult.payload) {
      return {
        success: false,
        error: analyticsResult.error ?? this.i18n.t('common.nats.errors.fetch_trend_analytics_failed')
      };
    }

    return {
      success: true,
      payload: this.buildProductCandidates(analyticsResult.payload, 'trend', limit)
    };
  }

  async getProductSalesAnalyticsForRestockCandidates(
    limit = 20
  ): Promise<BaseResponseAPI<ProductSalesAnalyticsCandidate[]>> {
    const analyticsResult = await this.getProductSalesAnalyticsForRestock();
    if (!analyticsResult.success || !analyticsResult.payload) {
      return {
        success: false,
        error: analyticsResult.error ?? this.i18n.t('common.nats.errors.fetch_restock_analytics_failed')
      };
    }

    const knownVariantIds = new Set(
      analyticsResult.payload.map((item) => item.variantId)
    );
    const criticalVariants = await this.getCriticalLowStockVariants(knownVariantIds);
    const enrichedVariants = [...analyticsResult.payload, ...criticalVariants.variants];

    return {
      success: true,
      payload: this.buildProductCandidates(
        enrichedVariants,
        'restock',
        limit,
        criticalVariants.ids
      )
    };
  }

  /**
   * Lấy tất cả variant với dữ liệu bán hàng theo ngày (2 tháng gần nhất)
   * Sử dụng cho tool dự đoán tái cấp hàng
   * Lấy từ NATS Repository thay vì direct Prisma
   */
  async getProductSalesAnalyticsForRestock(): Promise<
    BaseResponseAPI<VariantSalesAnalyticsResponse[]>
  > {
    return await funcHandlerAsync(
      async () => {
        const months = 2;
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());

        // Fetch aggregated sales data from Main Backend via NATS
        const salesData = (await this.salesNatsRepo.getVariantSalesAnalytics(
          months
        )) as VariantSalesAnalyticsRedisResponse[];

        if (!Array.isArray(salesData)) {
          throw new Error(this.i18n.t('common.nats.errors.invalid_sales_analytics_response'));
        }

        // Map the results to VariantSalesAnalyticsResponse
        const results = salesData.map((item) => {
          const dailySalesData: DailySalesRecord[] = (item.dailySales || [])
            .map((ds) => ({
              date: ds.date,
              quantitySold: ds.quantitySold,
              revenue: Number(ds.revenue)
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

          // Calculate summary stats
          const totalQuantitySold = dailySalesData.reduce((sum, record) => sum + record.quantitySold, 0);
          const totalRevenue = dailySalesData.reduce((sum, record) => sum + record.revenue, 0);
          const daysWithSalesCount = dailySalesData.length;
          const averageDailySales = daysWithSalesCount > 0 ? totalQuantitySold / daysWithSalesCount : 0;

          // Calculate metrics for LLM
          const salesMetrics = calculateSalesMetrics(dailySalesData);

          return new VariantSalesAnalyticsResponse({
            variantId: item.variantId,
            sku: item.sku,
            productName: item.productName,
            volumeMl: item.volumeMl,
            type: item.type,
            basePrice: Number(item.basePrice),
            status: item.status,
            concentrationName: item.concentrationName,
            dailySalesData,
            totalQuantitySold,
            totalRevenue,
            averageDailySales: Number(averageDailySales.toFixed(2)),
            periodStartDate: startDate.toISOString().split('T')[0],
            periodEndDate: now.toISOString().split('T')[0],
            daysWithSalesCount,
            salesMetrics
          });
        });

        return {
          success: true,
          payload: results
        };
      },
      this.i18n.t('common.nats.errors.fetch_sales_analytics_failed'),
      true
    );
  }

  /**
   * Lấy dữ liệu phân tích bán hàng cho một variant cụ thể
   */
  async getVariantSalesAnalyticsById(
    variantId: string
  ): Promise<BaseResponseAPI<VariantSalesAnalyticsResponse>> {
    const all = await this.getProductSalesAnalyticsForRestock();
    if (!all.success || !all.payload) {
      return { success: false, error: all.error };
    }
    const found = all.payload.find(v => v.variantId === variantId);
    if (!found) return { success: false, error: this.i18n.t('common.nats.errors.fetch_sales_analytics_failed') };
    return { success: true, payload: found };
  }
}

type CandidateMode = 'trend' | 'restock';
