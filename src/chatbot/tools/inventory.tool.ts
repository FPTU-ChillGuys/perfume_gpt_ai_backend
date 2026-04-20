import { Injectable, Logger } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { PrismaService } from 'src/prisma/prisma.service';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { RestockService } from 'src/infrastructure/domain/restock/restock.service';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { encodeToolOutput } from '../utils/toon-encoder.util';
import * as z from 'zod';

@Injectable()
export class InventoryTool {
  private readonly logger = new Logger(InventoryTool.name);
  private readonly trendAnalyticsProductLimit = 15;
  private readonly restockAnalyticsProductLimit = 20;

  constructor(
    private readonly prisma: PrismaService,
    private readonly unitOfWork: UnitOfWork,
    private readonly restockService: RestockService
  ) { }

  /**
   * Lấy dữ liệu tồn kho tất cả variant.
   * AI dùng tool này để biết totalQuantity, reservedQuantity, lowStockThreshold và status.
   */
  getInventoryStock: Tool = tool({
    description:
      'Get current inventory stock for all product variants. ' +
      'Returns each variant with totalQuantity, reservedQuantity, lowStockThreshold, and status. ' +
      'Output is TOON-compressed to optimize token usage. ' +
      'Use this as the primary data source for restock analysis.',
    inputSchema: z.object({}),
    execute: async () => {
      this.logger.log(`[getInventoryStock] called`);
      return await funcHandlerAsync(
        async () => {
          const stocks = await this.prisma.stocks.findMany({
            orderBy: { TotalQuantity: 'asc' },
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

          const encodingResult = encodeToolOutput(items);
          return { success: true, encodedData: encodingResult.encoded };
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
      'Output is TOON-compressed to reduce token usage. ' +
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

          const fullData = logs.map((l) => ({
            createdAt: l.createdAt,
            trendData: l.trendData
          }));

          const encodingResult = encodeToolOutput(fullData);
          return { success: true, encodedData: encodingResult.encoded };
        },
        'Error occurred while fetching trend logs.',
        true
      );
    }
  });

  /**
   * Lấy danh sách sản phẩm có khả năng trend dựa trên sales analytics.
   * Chỉ lấy tối đa 15 sản phẩm để giảm token cho luồng trend.
   */
  getProductSalesAnalyticsForTrend: Tool = tool({
    description:
      'Get top 15 trend-candidate products from sales analytics. ' +
      'Each candidate includes aggregated product sales signals and prioritized variant list. ' +
      'Output is TOON-compressed to reduce token usage.',
    inputSchema: z.object({}),
    execute: async () => {
      this.logger.log(`[getProductSalesAnalyticsForTrend] called`);
      return await funcHandlerAsync(
        async () => {
          const result = await this.restockService.getProductSalesAnalyticsForTrendCandidates(
            this.trendAnalyticsProductLimit
          );
          if (!result.success || !result.payload) {
            return {
              success: false,
              error: result.error ?? 'Failed to fetch trend analytics candidates'
            };
          }

          const encodingResult = encodeToolOutput(result.payload);
          return { success: true, encodedData: encodingResult.encoded };
        },
        'Error occurred while fetching trend sales analytics candidates.',
        true
      );
    }
  });

  /**
   * Lấy danh sách sản phẩm cần restock dựa trên sales analytics.
   * Chỉ lấy tối đa 20 sản phẩm có sales > 0, sản phẩm không cần restock sẽ không xuất hiện.
   * 
   * 🎯 Dữ liệu đã tối ưu: product-level candidates thay vì toàn bộ variant.
   */
  getProductSalesAnalyticsForRestock: Tool = tool({
    description:
      'Get top 20 restock-candidate products from sales analytics. ' +
      'Products with no restock need are excluded from output. ' +
      'Each candidate includes aggregated product sales signals and prioritized variant list. ' +
      'Output is TOON-compressed to reduce token usage. ' +
      'Use this data to predict restock demand based on sales velocity patterns and trend signals.',
    inputSchema: z.object({}),
    execute: async () => {
      this.logger.log(`[getProductSalesAnalyticsForRestock] called`);
      return await funcHandlerAsync(
        async () => {
          const result = await this.restockService.getProductSalesAnalyticsForRestockCandidates(
            this.restockAnalyticsProductLimit
          );
          if (!result.success || !result.payload) {
            return {
              success: false,
              error: result.error ?? 'Failed to fetch restock analytics candidates'
            };
          }

          const encodingResult = encodeToolOutput(result.payload);
          return { success: true, encodedData: encodingResult.encoded };
        },
        'Error occurred while fetching restock sales analytics candidates.',
        true
      );
    }
  });
}

