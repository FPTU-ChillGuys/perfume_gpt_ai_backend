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

/**
 * Service xử lý dữ liệu phân tích bán hàng variant để dự đoán tái cấp hàng
 * Lấy dữ liệu bán hàng từ 2 tháng gần nhất
 */
@Injectable()
export class RestockService {
  constructor(private readonly prisma: PrismaService) {}

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
