import { Injectable, Logger } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { PrismaService } from 'src/prisma/prisma.service';
import { UnitOfWork } from 'src/infrastructure/repositories/unit-of-work';
import { RestockService } from 'src/infrastructure/servicies/restock.service';
import { funcHandlerAsync } from 'src/infrastructure/utils/error-handler';
import * as z from 'zod';

@Injectable()
export class InventoryTool {
  private readonly logger = new Logger(InventoryTool.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly unitOfWork: UnitOfWork,
    private readonly restockService: RestockService
  ) {}

  /**
   * Lấy dữ liệu tồn kho tất cả variant.
   * AI dùng tool này để biết totalQuantity, reservedQuantity, lowStockThreshold và status.
   */
  getInventoryStock: Tool = tool({
    description:
      'Get current inventory stock for all product variants. ' +
      'Returns each variant with totalQuantity, reservedQuantity, lowStockThreshold, and status. ' +
      'Use this as the primary data source for restock analysis.',
    inputSchema: z.object({}),
    execute: async () => {
      this.logger.log(`[getInventoryStock] called`);
      return await funcHandlerAsync(
        async () => {
          const stocks = await this.prisma.stocks.findMany({
            include: {
              ProductVariants: {
                include: { Products: true, Concentrations: true }
              }
            }
          });

          const items = stocks.map((s) => ({
            variantId: s.VariantId,
            sku: s.ProductVariants.Sku,
            productName: s.ProductVariants.Products.Name,
            volumeMl: s.ProductVariants.VolumeMl,
            type: s.ProductVariants.Type,
            basePrice: Number(s.ProductVariants.BasePrice),
            status: s.ProductVariants.Status,
            concentrationName: s.ProductVariants.Concentrations.Name,
            totalQuantity: s.TotalQuantity,
            reservedQuantity: s.ReservedQuantity,
            lowStockThreshold: s.LowStockThreshold,
            isLowStock: s.TotalQuantity <= s.LowStockThreshold
          }));

          return { success: true, data: items };
        },
        'Error occurred while fetching inventory stock.',
        true
      );
    }
  });

  /**
   * Lấy 2 trend log mới nhất từ DB.
   * AI dùng tool này để điều chỉnh mức ưu tiên restock theo xu hướng hiện tại.
   */
  getLatestTrendLogs: Tool = tool({
    description:
      'Get the 2 most recent AI-generated trend snapshots. ' +
      'Use this to understand which product groups are trending and adjust restock priority. ' +
      'Do NOT use this to calculate sales velocity — only use for priority adjustment.',
    inputSchema: z.object({}),
    execute: async () => {
      this.logger.log(`[getLatestTrendLogs] called`);
      return await funcHandlerAsync(
        async () => {
          const logs = await this.unitOfWork.TrendLogRepo.find(
            {},
            { orderBy: { createdAt: 'DESC' }, limit: 2 }
          );

          const data = logs.map((l) => ({
            createdAt: l.createdAt,
            trendData: l.trendData
          }));

          return { success: true, data };
        },
        'Error occurred while fetching trend logs.',
        true
      );
    }
  });

  /**
   * Lấy dữ liệu phân tích bán hàng theo ngày cho tất cả variant (2 tháng gần nhất).
   * AI dùng tool này để dự đoán nhu cầu tái cấp hàng dựa trên xu hướng bán hàng của mỗi variant.
   */
  getProductSalesAnalyticsForRestock: Tool = tool({
    description:
      'Get daily sales analytics for all product variants over the past 2 months. ' +
      'Returns variant information with daily sales quantities, revenue trends, and average daily sales. ' +
      'Similar to getInventoryStock but includes historical sales data. ' +
      'Use this data to predict restock demand for each variant based on sales velocity and patterns.',
    inputSchema: z.object({}),
    execute: async () => {
      this.logger.log(`[getProductSalesAnalyticsForRestock] called`);
      return await funcHandlerAsync(
        async () => {
          const result = await this.restockService.getProductSalesAnalyticsForRestock();
          if (!result.success || !result.payload) {
            return { success: false, error: result.error ?? 'Failed to fetch sales analytics' };
          }

          // Format dữ liệu cho AI dùng dễ dàng hơn
          const items = result.payload.map((variant) => ({
            variantId: variant.variantId,
            sku: variant.sku,
            productName: variant.productName,
            volumeMl: variant.volumeMl,
            type: variant.type,
            basePrice: variant.basePrice,
            status: variant.status,
            concentrationName: variant.concentrationName,
            totalQuantitySold: variant.totalQuantitySold,
            totalRevenue: variant.totalRevenue,
            averageDailySales: variant.averageDailySales,
            daysWithSalesCount: variant.daysWithSalesCount,
            periodStartDate: variant.periodStartDate,
            periodEndDate: variant.periodEndDate,
            dailySalesData: variant.dailySalesData.map((record) => ({
              date: record.date,
              quantitySold: record.quantitySold,
              revenue: record.revenue
            }))
          }));

          return { success: true, data: items };
        },
        'Error occurred while fetching variant sales analytics.',
        true
      );
    }
  });
}

