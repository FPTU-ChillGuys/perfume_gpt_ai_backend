import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import {
  VariantSalesAnalyticsResponse,
  DailySalesRecord
} from 'src/application/dtos/response/variant-sales-analytics.response';
import { funcHandlerAsync } from '../utils/error-handler';
import { calculateSalesMetrics } from '../utils/sales-metrics.util';
import { Prisma } from 'generated/prisma/client';

const variantInclude = {
  Products: true,
  Concentrations: true
} satisfies Prisma.ProductVariantsInclude;

type VariantWithRelations = Prisma.ProductVariantsGetPayload<{
  include: typeof variantInclude;
}>;

type CandidateMode = 'trend' | 'restock';

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
 * Lấy dữ liệu bán hàng từ 2 tháng gần nhất
 */
@Injectable()
export class RestockService {
  constructor(private readonly prisma: PrismaService) {}

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
    const stocks = await this.prisma.stocks.findMany({
      where: {
        ProductVariants: {
          IsDeleted: false,
          Products: { IsDeleted: false }
        },
        TotalQuantity: { lte: this.prisma.stocks.fields.LowStockThreshold }
      },
      include: {
        ProductVariants: {
          include: {
            Products: true,
            Concentrations: true
          }
        }
      }
    });

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
   */
  async getProductSalesAnalyticsForRestock(): Promise<
    BaseResponseAPI<VariantSalesAnalyticsResponse[]>
  > {
    return await funcHandlerAsync(
      async () => {
        // Tính toán thời gian 2 tháng gần nhất
        const now = new Date();
        const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

        // Lấy tất cả variant không bị xóa
        const variants = await this.prisma.productVariants.findMany({
          where: { IsDeleted: false },
          include: variantInclude
        });

        // Lấy tất cả order details từ 2 tháng gần nhất
        const orderDetails = await this.prisma.orderDetails.findMany({
          where: {
            Orders: {
              CreatedAt: {
                gte: twoMonthsAgo
              },
              Status: {
                notIn: ['Canceled', 'Returned']
              }
            }
          },
          include: {
            Orders: true
          }
        });

        // Nhóm dữ liệu bán hàng theo variant
        const salesDataByVariant = new Map<
          string,
          { date: string; quantity: number; unitPrice: number }[]
        >();

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

        // Xây dựng response
        const results = variants.map((variant) => {
          const salesData = salesDataByVariant.get(variant.Id) || [];

          // Nhóm bán hàng theo ngày
          const dailyMap = new Map<
            string,
            { quantity: number; revenue: number }
          >();
          salesData.forEach((record) => {
            const existing = dailyMap.get(record.date) || { quantity: 0, revenue: 0 };
            dailyMap.set(record.date, {
              quantity: existing.quantity + record.quantity,
              revenue: existing.revenue + record.quantity * record.unitPrice
            });
          });

          // Tạo mảng records theo ngày được sắp xếp
          const dailySalesData: DailySalesRecord[] = Array.from(
            dailyMap.entries()
          )
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, data]) => ({
              date,
              quantitySold: data.quantity,
              revenue: data.revenue
            }));

          // Tính tổng thống kê
          const totalQuantitySold = dailySalesData.reduce(
            (sum, record) => sum + record.quantitySold,
            0
          );
          const totalRevenue = dailySalesData.reduce(
            (sum, record) => sum + record.revenue,
            0
          );
          const daysWithSalesCount = dailySalesData.length;
          const averageDailySales =
            daysWithSalesCount > 0 ? totalQuantitySold / daysWithSalesCount : 0;

          // Tính metrics tối ưu cho LLM
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

        return {
          success: true,
          payload: results
        };
      },
      'Failed to fetch variant sales analytics for restock',
      true
    );
  }

  /**
   * Lấy dữ liệu phân tích bán hàng cho một variant cụ thể
   * @param variantId ID của variant
   */
  async getVariantSalesAnalyticsById(
    variantId: string
  ): Promise<BaseResponseAPI<VariantSalesAnalyticsResponse>> {
    return await funcHandlerAsync(
      async () => {
        const now = new Date();
        const twoMonthsAgo = new Date(
          now.getFullYear(),
          now.getMonth() - 2,
          now.getDate()
        );

        // Lấy thông tin variant
        const variant = await this.prisma.productVariants.findUnique({
          where: { Id: variantId, IsDeleted: false },
          include: variantInclude
        });

        if (!variant) {
          return {
            success: false,
            error: 'Variant not found'
          };
        }

        // Lấy dữ liệu bán hàng của variant
        const orderDetails = await this.prisma.orderDetails.findMany({
          where: {
            VariantId: variantId,
            Orders: {
              CreatedAt: {
                gte: twoMonthsAgo
              },
              Status: {
                notIn: ['Canceled', 'Returned']
              }
            }
          },
          include: {
            Orders: true
          }
        });

        // Nhóm bán hàng theo ngày
        const dailyMap = new Map<
          string,
          { quantity: number; revenue: number }
        >();
        orderDetails.forEach((detail) => {
          const dateStr = detail.Orders.CreatedAt.toISOString().split('T')[0];
          const revenue = detail.Quantity * Number(detail.UnitPrice);
          const existing = dailyMap.get(dateStr) || { quantity: 0, revenue: 0 };
          dailyMap.set(dateStr, {
            quantity: existing.quantity + detail.Quantity,
            revenue: existing.revenue + revenue
          });
        });

        // Tạo mảng records theo ngày được sắp xếp
        const dailySalesData: DailySalesRecord[] = Array.from(
          dailyMap.entries()
        )
          .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
          .map(([date, data]) => ({
            date,
            quantitySold: data.quantity,
            revenue: data.revenue
          }));

        // Tính tổng thống kê
        const totalQuantitySold = dailySalesData.reduce(
          (sum, record) => sum + record.quantitySold,
          0
        );
        const totalRevenue = dailySalesData.reduce(
          (sum, record) => sum + record.revenue,
          0
        );
        const daysWithSalesCount = dailySalesData.length;
        const averageDailySales =
          daysWithSalesCount > 0
            ? totalQuantitySold / daysWithSalesCount
            : 0;

        // Tính metrics tối ưu cho LLM
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
}
