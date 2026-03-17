import { Injectable } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { PrismaService } from 'src/prisma/prisma.service';
import { UnitOfWork } from 'src/infrastructure/repositories/unit-of-work';
import { funcHandlerAsync } from 'src/infrastructure/utils/error-handler';
import * as z from 'zod';

@Injectable()
export class InventoryTool {
  constructor(
    private readonly prisma: PrismaService,
    private readonly unitOfWork: UnitOfWork
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
}
