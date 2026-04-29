import { Injectable } from '@nestjs/common';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import {
  VariantSalesAnalyticsResponse,
  DailySalesRecord
} from 'src/application/dtos/response/variant-sales-analytics.response';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { calculateSalesMetrics } from 'src/infrastructure/domain/utils/sales-metrics.util';
import { RestockAnalyticsRepository } from 'src/infrastructure/domain/restock/restock-analytics.repository';
import { CandidateMode, ProductVariantSalesCandidate, ProductSalesAnalyticsCandidate } from 'src/application/dtos/response/restock/sales-analytics.types';
import { RESTOCK_CONFIG } from 'src/application/constant/inventory.constant';

export type { ProductVariantSalesCandidate, ProductSalesAnalyticsCandidate };

@Injectable()
export class RestockService {
  constructor(private readonly restockAnalyticsRepo: RestockAnalyticsRepository) {}

  private inferAggregateTrend(last7DaysSales: number, last30DaysSales: number): 'INCREASING' | 'STABLE' | 'DECLINING' {
    if (last30DaysSales <= 0) {
      return 'STABLE';
    }
    const baseline = last30DaysSales / 4;
    if (last7DaysSales > baseline * RESTOCK_CONFIG.TREND_INCREASING_THRESHOLD) {
      return 'INCREASING';
    }
    if (last7DaysSales < baseline * RESTOCK_CONFIG.TREND_DECLINING_THRESHOLD) {
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
    const byProduct = this.groupVariantsByProduct(variants, mode, criticalVariantIds);
    const candidates = this.aggregateAndSortCandidates(byProduct, mode, limit);
    return candidates;
  }

  private groupVariantsByProduct(
    variants: VariantSalesAnalyticsResponse[],
    mode: CandidateMode,
    criticalVariantIds: Set<string>
  ): Map<string, ProductSalesAnalyticsCandidate> {
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
      current.hasCriticalStock = current.hasCriticalStock || criticalVariantIds.has(variant.variantId);
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
    return byProduct;
  }

  private aggregateAndSortCandidates(
    byProduct: Map<string, ProductSalesAnalyticsCandidate>,
    mode: CandidateMode,
    limit: number
  ): ProductSalesAnalyticsCandidate[] {
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
    const stocks = await this.restockAnalyticsRepo.findCriticalStocks();
    const ids = new Set<string>();
    const variants: VariantSalesAnalyticsResponse[] = [];
    const now = new Date();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());

    for (const stock of stocks) {
      const variantId = stock.VariantId;
      ids.add(variantId);
      if (knownVariantIds.has(variantId)) {
        continue;
      }
      variants.push(
        new VariantSalesAnalyticsResponse({
          variantId,
          sku: stock.ProductVariants.Sku,
          productName: stock.ProductVariants.Products.Name,
          volumeMl: stock.ProductVariants.VolumeMl,
          type: stock.ProductVariants.Type,
          basePrice: Number(stock.ProductVariants.BasePrice),
          status: stock.ProductVariants.Status,
          concentrationName: stock.ProductVariants.Concentrations.Name,
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
        error: analyticsResult.error ?? 'Failed to fetch trend sales analytics candidates'
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
        error: analyticsResult.error ?? 'Failed to fetch restock sales analytics candidates'
      };
    }

    const knownVariantIds = new Set(analyticsResult.payload.map((item) => item.variantId));
    const criticalVariants = await this.getCriticalLowStockVariants(knownVariantIds);
    const enrichedVariants = [...analyticsResult.payload, ...criticalVariants.variants];

    return {
      success: true,
      payload: this.buildProductCandidates(enrichedVariants, 'restock', limit, criticalVariants.ids)
    };
  }

  async getProductSalesAnalyticsForRestock(): Promise<
    BaseResponseAPI<VariantSalesAnalyticsResponse[]>
  > {
    return await funcHandlerAsync(
      async () => {
        const now = new Date();
        const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

        const [variants, orderDetails] = await Promise.all([
          this.restockAnalyticsRepo.findAllActiveVariants(),
          this.restockAnalyticsRepo.findOrderDetailsInDateRange(twoMonthsAgo)
        ]);

        const salesDataByVariant = this.groupOrderDetailsByVariant(orderDetails);
        const results = this.buildVariantAnalyticsResponses(variants, salesDataByVariant, twoMonthsAgo, now);

        return { success: true, payload: results };
      },
      'Failed to fetch variant sales analytics for restock',
      true
    );
  }

  private groupOrderDetailsByVariant(orderDetails: Awaited<ReturnType<RestockAnalyticsRepository['findOrderDetailsInDateRange']>>): Map<string, { date: string; quantity: number; unitPrice: number }[]> {
    const salesDataByVariant = new Map<string, { date: string; quantity: number; unitPrice: number }[]>();
    orderDetails.forEach((detail) => {
      const variantId = detail.VariantId;
      if (!salesDataByVariant.has(variantId)) {
        salesDataByVariant.set(variantId, []);
      }
      const dateStr = detail.Orders.CreatedAt.toISOString().split('T')[0];
      salesDataByVariant.get(variantId)!.push({
        date: dateStr,
        quantity: detail.Quantity,
        unitPrice: Number(detail.UnitPrice)
      });
    });
    return salesDataByVariant;
  }

  private buildVariantAnalyticsResponses(
    variants: Awaited<ReturnType<RestockAnalyticsRepository['findAllActiveVariants']>>,
    salesDataByVariant: Map<string, { date: string; quantity: number; unitPrice: number }[]>,
    twoMonthsAgo: Date,
    now: Date
  ): VariantSalesAnalyticsResponse[] {
    return variants.map((variant) => {
      const salesData = salesDataByVariant.get(variant.Id) || [];
      const dailySalesData = this.buildDailySalesRecords(salesData);
      const { totalQuantitySold, totalRevenue, daysWithSalesCount, averageDailySales } = this.computeSalesTotals(dailySalesData);
      const salesMetrics = calculateSalesMetrics(dailySalesData);

      return new VariantSalesAnalyticsResponse({
        variantId: variant.Id,
        sku: variant.Sku,
        productName: variant.Products.Name,
        volumeMl: variant.VolumeMl,
        type: variant.Type,
        basePrice: Number(variant.BasePrice),
        status: variant.Status,
        concentrationName: variant.Concentrations.Name,
        dailySalesData,
        totalQuantitySold,
        totalRevenue,
        averageDailySales: Number(averageDailySales.toFixed(2)),
        periodStartDate: twoMonthsAgo.toISOString().split('T')[0],
        periodEndDate: now.toISOString().split('T')[0],
        daysWithSalesCount,
        salesMetrics
      });
    });
  }

  private buildDailySalesRecords(salesData: { date: string; quantity: number; unitPrice: number }[]): DailySalesRecord[] {
    const dailyMap = new Map<string, { quantity: number; revenue: number }>();
    salesData.forEach((record) => {
      const existing = dailyMap.get(record.date) || { quantity: 0, revenue: 0 };
      dailyMap.set(record.date, {
        quantity: existing.quantity + record.quantity,
        revenue: existing.revenue + record.quantity * record.unitPrice
      });
    });

    return Array.from(dailyMap.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, data]) => ({
        date,
        quantitySold: data.quantity,
        revenue: data.revenue
      }));
  }

  private computeSalesTotals(dailySalesData: DailySalesRecord[]): {
    totalQuantitySold: number;
    totalRevenue: number;
    daysWithSalesCount: number;
    averageDailySales: number;
  } {
    const totalQuantitySold = dailySalesData.reduce((sum, record) => sum + record.quantitySold, 0);
    const totalRevenue = dailySalesData.reduce((sum, record) => sum + record.revenue, 0);
    const daysWithSalesCount = dailySalesData.length;
    const averageDailySales = daysWithSalesCount > 0 ? totalQuantitySold / daysWithSalesCount : 0;
    return { totalQuantitySold, totalRevenue, daysWithSalesCount, averageDailySales };
  }

  async getVariantSalesAnalyticsById(
    variantId: string
  ): Promise<BaseResponseAPI<VariantSalesAnalyticsResponse>> {
    return await funcHandlerAsync(
      async () => {
        const now = new Date();
        const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());

        const variant = await this.restockAnalyticsRepo.findVariantById(variantId);
        if (!variant) {
          return { success: false, error: 'Variant not found' };
        }

        const orderDetails = await this.restockAnalyticsRepo.findOrderDetailsByVariantId(variantId, twoMonthsAgo);
        const dailySalesData = this.buildDailySalesRecordsFromDetails(orderDetails);
        const { totalQuantitySold, totalRevenue, daysWithSalesCount, averageDailySales } = this.computeSalesTotals(dailySalesData);
        const salesMetrics = calculateSalesMetrics(dailySalesData);

        return {
          success: true,
          payload: new VariantSalesAnalyticsResponse({
            variantId: variant.Id,
            sku: variant.Sku,
            productName: variant.Products.Name,
            volumeMl: variant.VolumeMl,
            type: variant.Type,
            basePrice: Number(variant.BasePrice),
            status: variant.Status,
            concentrationName: variant.Concentrations.Name,
            dailySalesData,
            totalQuantitySold,
            totalRevenue,
            averageDailySales: Number(averageDailySales.toFixed(2)),
            periodStartDate: twoMonthsAgo.toISOString().split('T')[0],
            periodEndDate: now.toISOString().split('T')[0],
            daysWithSalesCount,
            salesMetrics
          })
        };
      },
      'Failed to fetch variant sales analytics',
      true
    );
  }

  private buildDailySalesRecordsFromDetails(
    orderDetails: Awaited<ReturnType<RestockAnalyticsRepository['findOrderDetailsByVariantId']>>
  ): DailySalesRecord[] {
    const dailyMap = new Map<string, { quantity: number; revenue: number }>();
    orderDetails.forEach((detail) => {
      const dateStr = detail.Orders.CreatedAt.toISOString().split('T')[0];
      const revenue = detail.Quantity * Number(detail.UnitPrice);
      const existing = dailyMap.get(dateStr) || { quantity: 0, revenue: 0 };
      dailyMap.set(dateStr, {
        quantity: existing.quantity + detail.Quantity,
        revenue: existing.revenue + revenue
      });
    });

    return Array.from(dailyMap.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, data]) => ({
        date,
        quantitySold: data.quantity,
        revenue: data.revenue
      }));
  }
}