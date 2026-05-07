import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

const stockVariantInclude = {
  ProductVariants: {
    include: {
      Products: true,
      Concentrations: true
    }
  }
} satisfies Prisma.StocksInclude;

export type StockWithVariant = Prisma.StocksGetPayload<{
  include: typeof stockVariantInclude;
}>;

const batchVariantInclude = {
  ProductVariants: {
    include: { Products: true, Concentrations: true }
  }
} satisfies Prisma.BatchesInclude;

export type BatchWithVariant = Prisma.BatchesGetPayload<{
  include: typeof batchVariantInclude;
}>;

@Injectable()
export class InventoryPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllStocks(
    where: Prisma.StocksWhereInput,
    skip: number,
    take: number
  ): Promise<StockWithVariant[]> {
    return this.prisma.stocks.findMany({
      where,
      skip,
      take,
      include: stockVariantInclude
    });
  }

  async countStocks(where: Prisma.StocksWhereInput): Promise<number> {
    return this.prisma.stocks.count({ where });
  }

  async findBatches(
    where: Prisma.BatchesWhereInput,
    skip: number,
    take: number
  ): Promise<BatchWithVariant[]> {
    return this.prisma.batches.findMany({
      where,
      skip,
      take,
      include: batchVariantInclude
    });
  }

  async countBatches(where: Prisma.BatchesWhereInput): Promise<number> {
    return this.prisma.batches.count({ where });
  }

  async countVariants(): Promise<number> {
    return this.prisma.productVariants.count({
      where: { IsDeleted: false, Products: { IsDeleted: false } }
    });
  }

  async countLowStocks(): Promise<number> {
    return this.prisma.stocks.count({
      where: {
        TotalQuantity: {
          gt: 0,
          lte: this.prisma.stocks.fields.LowStockThreshold
        },
        ProductVariants: { IsDeleted: false, Products: { IsDeleted: false } }
      }
    });
  }

  async countOutOfStocks(): Promise<number> {
    return this.prisma.stocks.count({
      where: {
        TotalQuantity: 0,
        ProductVariants: { IsDeleted: false, Products: { IsDeleted: false } }
      }
    });
  }

  async countExpiredBatches(now: Date): Promise<number> {
    return this.prisma.batches.count({
      where: {
        ExpiryDate: { lt: now },
        RemainingQuantity: { gt: 0 },
        ProductVariants: { IsDeleted: false, Products: { IsDeleted: false } }
      }
    });
  }

  async countNearExpiryBatches(from: Date, to: Date): Promise<number> {
    return this.prisma.batches.count({
      where: {
        ExpiryDate: { gte: from, lt: to },
        RemainingQuantity: { gt: 0 },
        ProductVariants: { IsDeleted: false, Products: { IsDeleted: false } }
      }
    });
  }

  async findProblematicStocks(
    nearExpiryDate: Date
  ): Promise<StockWithVariant[]> {
    return this.prisma.stocks.findMany({
      where: {
        OR: [
          {
            TotalQuantity: { lte: this.prisma.stocks.fields.LowStockThreshold }
          },
          {
            ProductVariants: {
              Batches: {
                some: {
                  ExpiryDate: { lt: nearExpiryDate },
                  RemainingQuantity: { gt: 0 }
                }
              }
            }
          }
        ],
        ProductVariants: { IsDeleted: false, Products: { IsDeleted: false } }
      },
      include: stockVariantInclude
    });
  }

  async findAllStocksSorted(take: number): Promise<StockWithVariant[]> {
    return this.prisma.stocks.findMany({
      where: {
        ProductVariants: { IsDeleted: false, Products: { IsDeleted: false } }
      },
      orderBy: { TotalQuantity: 'asc' },
      take,
      include: stockVariantInclude
    });
  }

  async findStocksByThreshold(): Promise<StockWithVariant[]> {
    return this.prisma.stocks.findMany({
      where: {
        ProductVariants: {
          IsDeleted: false,
          Products: { IsDeleted: false }
        },
        TotalQuantity: { lte: this.prisma.stocks.fields.LowStockThreshold }
      },
      include: stockVariantInclude
    });
  }

  async findBatchesByVariantIds(
    variantIds: string[]
  ): Promise<Prisma.BatchesGetPayload<{}>[]> {
    return this.prisma.batches.findMany({
      where: {
        VariantId: { in: variantIds },
        RemainingQuantity: { gt: 0 }
      },
      orderBy: { ExpiryDate: 'asc' }
    });
  }

  async findAllStocksForTool(): Promise<StockWithVariant[]> {
    return this.prisma.stocks.findMany({
      orderBy: { TotalQuantity: 'asc' },
      include: stockVariantInclude
    });
  }

  async getInventoryOverallStats(): Promise<{
    totalSku: number;
    lowStockSku: number;
    outOfStockSku: number;
    expiredBatches: number;
    nearExpiryBatches: number;
  }> {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const [totalSku, lowStockSku, outOfStockSku, expiredBatches, nearExpiryBatches] = await Promise.all([
      this.countVariants(),
      this.countLowStocks(),
      this.countOutOfStocks(),
      this.countExpiredBatches(now),
      this.countNearExpiryBatches(now, thirtyDaysFromNow)
    ]);

    return {
      totalSku,
      lowStockSku: lowStockSku + outOfStockSku,
      outOfStockSku,
      expiredBatches,
      nearExpiryBatches
    };
  }
}
