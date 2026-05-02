import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SlowStockRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllStocksWithRelations(): Promise<
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
        }
      },
      include: {
        ProductVariants: {
          include: { Products: true, Concentrations: true }
        }
      }
    });
  }
}
