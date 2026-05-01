import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

const variantInclude = {
  Products: true,
  Concentrations: true
} satisfies Prisma.ProductVariantsInclude;

export type VariantWithRelations = Prisma.ProductVariantsGetPayload<{
  include: typeof variantInclude;
}>;

@Injectable()
export class RestockAnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActiveVariants(): Promise<VariantWithRelations[]> {
    return this.prisma.productVariants.findMany({
      where: { IsDeleted: false },
      include: variantInclude
    });
  }

  async findOrderDetailsInDateRange(
    from: Date,
    to?: Date
  ): Promise<Prisma.OrderDetailsGetPayload<{ include: { Orders: true } }>[]> {
    const where: Prisma.OrderDetailsWhereInput = {
      Orders: {
        CreatedAt: { gte: from },
        Status: { notIn: ['Canceled', 'Returned'] }
      }
    };
    if (to) {
      where.Orders!.CreatedAt = { gte: from, lte: to };
    }
    return this.prisma.orderDetails.findMany({
      where,
      include: { Orders: true }
    });
  }

  async findCriticalStocks(): Promise<
    Prisma.StocksGetPayload<{
      include: {
        ProductVariants: {
          include: { Products: true; Concentrations: true };
        };
      };
    }>[]
  > {
    return this.prisma.stocks.findMany({
      where: {
        ProductVariants: {
          IsDeleted: false,
          Products: { IsDeleted: false }
        },
        TotalQuantity: { lte: this.prisma.stocks.fields.LowStockThreshold }
      },
      include: {
        ProductVariants: {
          include: { Products: true, Concentrations: true }
        }
      }
    });
  }

  async findVariantById(id: string): Promise<VariantWithRelations | null> {
    return this.prisma.productVariants.findUnique({
      where: { Id: id, IsDeleted: false },
      include: variantInclude
    });
  }

  async findOrderDetailsByVariantId(
    variantId: string,
    from: Date,
    to?: Date
  ): Promise<Prisma.OrderDetailsGetPayload<{ include: { Orders: true } }>[]> {
    const createdAtFilter: Prisma.DateTimeFilter = to
      ? { gte: from, lte: to }
      : { gte: from };
    return this.prisma.orderDetails.findMany({
      where: {
        VariantId: variantId,
        Orders: {
          CreatedAt: createdAtFilter,
          Status: { notIn: ['Canceled', 'Returned'] }
        }
      },
      include: { Orders: true }
    });
  }
}
