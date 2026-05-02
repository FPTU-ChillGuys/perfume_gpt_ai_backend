import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PrismaMasterDataRepository {
  private readonly logger = new Logger(PrismaMasterDataRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Bulk fetch (for Dictionary Builder) ───────────────────────

  async getAllBrands() {
    const data = await this.prisma.brands.findMany();
    this.logger.log(`Fetched ${data.length} brands`);
    return data;
  }

  async getAllCategories() {
    const data = await this.prisma.categories.findMany();
    this.logger.log(`Fetched ${data.length} categories`);
    return data;
  }

  async getAllConcentrations() {
    const data = await this.prisma.concentrations.findMany();
    this.logger.log(`Fetched ${data.length} concentrations`);
    return data;
  }

  async getAllOlfactoryFamilies() {
    const data = await this.prisma.olfactoryFamilies.findMany();
    this.logger.log(`Fetched ${data.length} olfactory families`);
    return data;
  }

  async getAllScentNotes() {
    const data = await this.prisma.scentNotes.findMany();
    this.logger.log(`Fetched ${data.length} scent notes`);
    return data;
  }

  async getAllAttributesWithValues() {
    const data = await this.prisma.attributes.findMany({
      include: { AttributeValues: true }
    });
    this.logger.log(`Fetched ${data.length} attributes with values`);
    return data;
  }

  async getAllProducts() {
    const data = await this.prisma.products.findMany({
      include: {
        ProductFamilyMaps: true,
        ProductNoteMaps: true,
        ProductAttributes: true
      }
    });
    this.logger.log(`Fetched ${data.length} products`);
    return data;
  }

  async getAllProductVariants() {
    const data = await this.prisma.productVariants.findMany();
    this.logger.log(`Fetched ${data.length} product variants`);
    return data;
  }

  // ─── Normalization context (limited fetches for AI context) ────

  async getScentNotesForContext(take: number = 300) {
    return this.prisma.scentNotes.findMany({
      select: { Name: true },
      orderBy: { Name: 'asc' },
      take
    });
  }

  async getOlfactoryFamiliesForContext(take: number = 200) {
    return this.prisma.olfactoryFamilies.findMany({
      select: { Name: true },
      orderBy: { Name: 'asc' },
      take
    });
  }

  async getProductsForContext(take: number = 300) {
    return this.prisma.products.findMany({
      where: { IsDeleted: false },
      select: {
        Id: true,
        Name: true,
        Origin: true,
        Gender: true,
        ReleaseYear: true,
        Brands: { select: { Name: true } },
        Categories: { select: { Name: true } }
      },
      orderBy: { UpdatedAt: 'desc' },
      take
    });
  }

  async getProductVariantsForContext(take: number = 600) {
    return this.prisma.productVariants.findMany({
      where: { IsDeleted: false },
      select: {
        Type: true,
        Longevity: true,
        Sillage: true,
        Concentrations: { select: { Name: true } }
      },
      take
    });
  }

  // ─── Search (for MasterDataService) ────────────────────────────

  async searchBrands(keyword: string, take: number = 10) {
    return this.prisma.brands.findMany({
      where: { Name: { contains: keyword } },
      take
    });
  }

  async searchCategories(keyword: string, take: number = 10) {
    return this.prisma.categories.findMany({
      where: { Name: { contains: keyword } },
      take
    });
  }

  async searchScentNotes(keyword: string, take: number = 20) {
    return this.prisma.scentNotes.findMany({
      where: { Name: { contains: keyword } },
      take
    });
  }

  async searchOlfactoryFamilies(keyword: string, take: number = 10) {
    return this.prisma.olfactoryFamilies.findMany({
      where: { Name: { contains: keyword } },
      take
    });
  }

  async searchAttributeValues(keyword: string, take: number = 20) {
    return this.prisma.attributeValues.findMany({
      where: { Value: { contains: keyword } },
      include: { Attributes: true },
      take
    });
  }

  async searchProducts(keyword: string, take: number = 10) {
    return this.prisma.products.findMany({
      where: { Name: { contains: keyword } },
      select: { Id: true, Name: true },
      take
    });
  }

  async countProducts(where: Record<string, unknown>) {
    return this.prisma.products.count({
      where: { IsDeleted: false, ...where } as Record<string, unknown>
    });
  }

  // ─── Fuzzy search helpers (all rows, minimal select) ───────────

  async getAllBrandsForFuzzy() {
    return this.prisma.brands.findMany({ select: { Id: true, Name: true } });
  }

  async getAllCategoriesForFuzzy() {
    return this.prisma.categories.findMany({
      select: { Id: true, Name: true }
    });
  }

  async getAllScentNotesForFuzzy() {
    return this.prisma.scentNotes.findMany({
      select: { Id: true, Name: true }
    });
  }

  async getAllOlfactoryFamiliesForFuzzy() {
    return this.prisma.olfactoryFamilies.findMany({
      select: { Id: true, Name: true }
    });
  }

  async getAllAttributeValuesForFuzzy() {
    return this.prisma.attributeValues.findMany({
      select: { Id: true, Value: true }
    });
  }
}
