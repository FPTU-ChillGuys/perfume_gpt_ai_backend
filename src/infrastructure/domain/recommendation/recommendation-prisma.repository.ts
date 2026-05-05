import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

const PRODUCT_INCLUDE = {
  Brands: true,
  Media: { where: { IsPrimary: true } },
  ProductVariants: {
    where: { IsDeleted: false, Status: 'Active' },
    take: 3,
    orderBy: { BasePrice: 'asc' as const }
  }
};

@Injectable()
export class RecommendationPrismaRepository {
  private readonly logger = new Logger(RecommendationPrismaRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findProductAttributesByVariantIds(variantIds: string[]): Promise<unknown[]> {
    return this.prisma.productVariants.findMany({
      where: { Id: { in: variantIds } },
      include: {
        Products: {
          include: {
            Brands: true,
            ProductNoteMaps: { include: { ScentNotes: true } },
            ProductFamilyMaps: { include: { OlfactoryFamilies: true } }
          }
        }
      }
    });
  }

  async findProductsByBrand(brand: string, limit: number, budgetHint: { min: number; max: number } | null): Promise<unknown[]> {
    const products = await this.prisma.products.findMany({
      where: {
        IsDeleted: false,
        Brands: { Name: brand },
        ...(budgetHint ? { ProductVariants: { some: { BasePrice: { gte: budgetHint.min, lte: budgetHint.max } } } } : {})
      },
      include: PRODUCT_INCLUDE,
      take: limit
    });
    this.logger.log(`[BRAND] brand="${brand}" found=${products.length}`);
    return products as unknown[];
  }

  async findProductsByScent(scent: string, limit: number, budgetHint: { min: number; max: number } | null): Promise<unknown[]> {
    const products = await this.prisma.products.findMany({
      where: {
        IsDeleted: false,
        OR: [
          { ProductNoteMaps: { some: { ScentNotes: { Name: { contains: scent } } } } },
          { Brands: { OR: [{ Name: { contains: scent } }] } }
        ],
        ...(budgetHint ? { ProductVariants: { some: { BasePrice: { gte: budgetHint.min, lte: budgetHint.max } } } } : {})
      },
      include: PRODUCT_INCLUDE,
      take: limit
    });
    this.logger.log(`[SCENT] scent="${scent}" found=${products.length}`);
    return products as unknown[];
  }

  async findProductsByIds(productIds: string[]): Promise<unknown[]> {
    return this.prisma.products.findMany({
      where: { Id: { in: productIds } },
      include: PRODUCT_INCLUDE
    });
  }
}
