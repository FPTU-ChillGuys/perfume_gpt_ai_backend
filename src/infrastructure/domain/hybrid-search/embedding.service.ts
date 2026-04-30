import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PrismaService } from 'src/prisma/prisma.service';
import { FptEmbeddingService } from './fpt-embedding.service';
import { ProductEmbedding } from './entities/product-embedding.entity';
import { TextNormalizer } from './utils/text-normalizer';
import { VectorSearchResult, EmbeddingStats } from 'src/application/dtos/response/hybrid-search/hybrid-search.types';
import { HYBRID_SEARCH_CONFIG } from 'src/application/constant/hybrid-search.config';

interface ProductData {
  Id: string;
  Name: string;
  Description: string | null;
  Gender: string;
  Origin: string;
  ReleaseYear: number;
  BrandId: number;
  CategoryId: number;
  Brands: { Name: string };
  Categories: { Name: string };
  ProductNoteMaps: Array<{ ScentNotes: { Name: string } }>;
  ProductFamilyMaps: Array<{ OlfactoryFamilies: { Name: string } }>;
  ProductVariants: Array<{
    BasePrice: number;
    Longevity: number;
    Sillage: number;
    Concentrations: { Name: string };
  }>;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fptEmbeddingService: FptEmbeddingService,
    public readonly em: EntityManager
  ) {}

  private localizeGender(gender: string): string {
    if (!gender) return 'không rõ';
    const g = gender.toLowerCase();
    if (g === 'male' || g === 'nam') return 'Nam';
    if (g === 'female' || g === 'nữ') return 'Nữ';
    return gender;
  }

  private formatPriceToVietnamese(price: number): string {
    if (!price || price <= 0) return 'không rõ';
    const trieu = Math.floor(price / 1000000);
    const nghin = Math.floor((price % 1000000) / 1000);
    let result = '';
    if (trieu > 0) result += `${trieu} triệu `;
    if (nghin > 0) result += `${nghin} nghìn`;
    return result.trim() || `${price}đ`;
  }

  buildProductDescription(
    product: ProductData,
    brandName: string,
    categoryName: string,
    scentNotes: string[],
    olfactoryFamilies: string[],
    concentrationName: string,
    variants: ProductData['ProductVariants']
  ): string {
    const variantWithStats = variants.find(v => v.Longevity > 0 || v.Sillage > 0);
    const longevity = variantWithStats?.Longevity || 0;
    const sillage = variantWithStats?.Sillage || 0;
    const minPrice = Math.min(...variants.map(v => v.BasePrice || 0));
    const priceText = this.formatPriceToVietnamese(minPrice);

    const descriptionText = `
Nước hoa ${product.Name} thương hiệu ${brandName}, xuất xứ ${product.Origin}, ra mắt năm ${product.ReleaseYear}.
Giới tính: ${this.localizeGender(product.Gender)}.
Giá khoảng: ${minPrice.toLocaleString('vi-VN')}đ (${priceText}).
Các tầng hương: ${scentNotes.length > 0 ? scentNotes.join(', ') : 'không rõ'}.
Phong cách: ${olfactoryFamilies.length > 0 ? olfactoryFamilies.join(', ') : 'không rõ'}.
Nồng độ: ${concentrationName}.
Độ lưu hương: ${longevity}/10.
Độ tỏa hương: ${sillage}/10.
Mô tả: ${product.Description || 'Không có mô tả'}.
`;

    return TextNormalizer.stripHtml(descriptionText);
  }

  buildStructuredSearchText(
    product: ProductData,
    brandName: string,
    categoryName: string,
    scentNotes: string[],
    olfactoryFamilies: string[],
    variants: ProductData['ProductVariants']
  ): string {
    const cleanName = TextNormalizer.clean(product.Name);
    const cleanBrand = TextNormalizer.clean(brandName);
    const cleanCategory = TextNormalizer.clean(categoryName);
    const cleanGender = TextNormalizer.clean(this.localizeGender(product.Gender));
    const cleanOrigin = TextNormalizer.clean(product.Origin);
    const cleanNotes = scentNotes.map(n => TextNormalizer.clean(n)).join(', ');
    const cleanFamilies = olfactoryFamilies.map(f => TextNormalizer.clean(f)).join(', ');
    const cleanDesc = TextNormalizer.clean(product.Description ?? '');

    const minPrice = Math.min(...variants.map(v => v.BasePrice || 0));
    const priceText = this.formatPriceToVietnamese(minPrice);
    const cleanPriceText = TextNormalizer.clean(priceText);

    const keywords = `${cleanName} ${cleanBrand} ${cleanGender} ${cleanOrigin} ${cleanPriceText} nuoc hoa ${cleanName} ${cleanBrand}`.trim();

    const lines = [
      `name: ${product.Name}`,
      `brand: ${brandName}`,
      `category: ${categoryName}`,
      `gender: ${this.localizeGender(product.Gender)}`,
      `origin: ${product.Origin}`,
      `year: ${product.ReleaseYear}`,
      `price: ${minPrice} (${priceText})`,
      `notes: ${cleanNotes}`,
      `families: ${cleanFamilies}`,
      `description: ${cleanDesc}`,
      `keywords: ${keywords}`,
      `aliases: ${cleanName}, ${cleanBrand}`
    ];

    return lines.join('\n');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return await this.fptEmbeddingService.generateEmbedding(text);
  }

  async upsertEmbedding(
    productId: string,
    vector: number[],
    description: string,
    searchText?: string
  ): Promise<void> {
    const vectorString = `[${vector.join(',')}]`;
    await this.em.getConnection().execute(
      `INSERT INTO product_embeddings (product_id, vector, description, search_text, created_at, updated_at, is_active)
       VALUES (?, ?::vector(1024), ?, ?, NOW(), NOW(), true)
       ON CONFLICT (product_id) 
       DO UPDATE SET 
         vector = EXCLUDED.vector,
         description = EXCLUDED.description,
         search_text = EXCLUDED.search_text,
         updated_at = NOW(),
         is_active = true`,
      [productId, vectorString, description, searchText || null]
    );
  }

  async rebuildProductEmbedding(productId: string): Promise<boolean> {
    try {
      const product = await this.fetchProductForEmbedding(productId);
      if (!product) {
        this.logger.error(`Product not found: ${productId}`);
        return false;
      }

      const { description, searchText } = this.buildEmbeddingTexts(product);
      const vector = await this.generateEmbedding(description);
      await this.upsertEmbedding(product.Id, vector, description, searchText);

      this.logger.log(`Rebuilt embedding for product: ${productId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error rebuilding embedding for ${productId}`, error);
      return false;
    }
  }

  private async fetchProductForEmbedding(productId: string): Promise<ProductData | null> {
    const product = await this.prisma.products.findFirst({
      where: { Id: productId, IsDeleted: false },
      include: {
        Brands: true,
        Categories: true,
        ProductNoteMaps: { include: { ScentNotes: true } },
        ProductFamilyMaps: { include: { OlfactoryFamilies: true } },
        ProductVariants: {
          where: { IsDeleted: false },
          include: {
            Concentrations: true,
            ProductAttributes: { include: { Attributes: true, AttributeValues: true } }
          }
        },
        Media: { where: { IsPrimary: true } }
      }
    });

    if (!product) return null;
    return product as unknown as ProductData;
  }

  private buildEmbeddingTexts(product: ProductData): { description: string; searchText: string } {
    const scentNotes = product.ProductNoteMaps.map(pnm => pnm.ScentNotes.Name);
    const olfactoryFamilies = product.ProductFamilyMaps.map(pfm => pfm.OlfactoryFamilies.Name);
    const concentrationName = product.ProductVariants[0]?.Concentrations.Name || 'N/A';

    const description = this.buildProductDescription(
      product, product.Brands.Name, product.Categories.Name,
      scentNotes, olfactoryFamilies, concentrationName, product.ProductVariants
    );

    const searchText = this.buildStructuredSearchText(
      product, product.Brands.Name, product.Categories.Name,
      scentNotes, olfactoryFamilies, product.ProductVariants
    );

    return { description, searchText };
  }

  async rebuildAllEmbeddings(): Promise<{ success: number; failed: number }> {
    try {
      const products = await this.prisma.products.findMany({
        where: { IsDeleted: false },
        select: { Id: true }
      });

      let success = 0;
      let failed = 0;

      for (const product of products) {
        const result = await this.rebuildProductEmbedding(product.Id);
        if (result) { success++; } else { failed++; }
        await new Promise(resolve => setTimeout(resolve, HYBRID_SEARCH_CONFIG.REBUILD_BATCH_DELAY_MS));
      }

      this.logger.log(`Rebuilt ${success} embeddings, ${failed} failed`);
      return { success, failed };
    } catch (error) {
      this.logger.error('Error rebuilding all embeddings', error);
      return { success: 0, failed: 0 };
    }
  }

  async vectorSearch(queryEmbedding: number[], limit: number): Promise<VectorSearchResult[]> {
    try {
      const embStr = JSON.stringify(queryEmbedding);
      const result = await this.em.getConnection().execute(
        `SELECT product_id, 1 - (vector <=> ?::vector(1024)) AS similarity FROM "product_embeddings" WHERE is_active = true ORDER BY vector <=> ?::vector(1024) LIMIT ?`,
        [embStr, embStr, limit]
      );

      const rows = this.extractRows(result);
      return rows.map(row => ({
        productId: row.product_id as string,
        similarity: parseFloat(row.similarity as string)
      }));
    } catch (error) {
      this.logger.error('Vector search error', error);
      return [];
    }
  }

  async getEmbeddingsStats(): Promise<EmbeddingStats> {
    try {
      const result = await this.em.getConnection().execute(
        `SELECT COUNT(*) as total, MAX(updated_at) as lastRebuild FROM "product_embeddings"`
      );

      const rows = this.extractRows(result);
      const row = rows[0] ?? { total: '0', lastRebuild: null };
      return {
        total: parseInt(row.total as string),
        lastRebuild: row.lastRebuild ? new Date(row.lastRebuild as string).toISOString() : undefined
      };
    } catch (error) {
      this.logger.error('Get stats error', error);
      return { total: 0 };
    }
  }

  private extractRows(result: unknown): Record<string, unknown>[] {
    if (Array.isArray(result)) return result as Record<string, unknown>[];
    const obj = result as Record<string, unknown>;
    if (obj?.rows && Array.isArray(obj.rows)) return obj.rows as Record<string, unknown>[];
    return [];
  }
}