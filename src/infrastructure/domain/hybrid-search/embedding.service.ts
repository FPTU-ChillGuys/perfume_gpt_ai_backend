import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PrismaService } from '../../../prisma/prisma.service';
import { FptEmbeddingService } from './fpt-embedding.service';
import { ProductEmbedding } from './entities/product-embedding.entity';
import { TextNormalizer } from './utils/text-normalizer';

/**
 * EmbeddingService - Service xử lý embedding generation và vector search
 */
@Injectable()
export class EmbeddingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fptEmbeddingService: FptEmbeddingService,
    public readonly em: EntityManager
  ) {}

  /**
   * Helper để Việt hóa giới tính
   */
  private localizeGender(gender: string): string {
    if (!gender) return 'không rõ';
    const g = gender.toLowerCase();
    if (g === 'male' || g === 'nam') return 'Nam';
    if (g === 'female' || g === 'nữ') return 'Nữ';
    return gender;
  }

  /**
   * Helper chuyển số tiền thành chữ tiếng Việt (triệu/nghìn)
   */
  private formatPriceToVietnamese(price: number): string {
    if (!price || price <= 0) return 'không rõ';
    
    const trieu = Math.floor(price / 1000000);
    const nghin = Math.floor((price % 1000000) / 1000);
    
    let result = '';
    if (trieu > 0) result += `${trieu} triệu `;
    if (nghin > 0) result += `${nghin} nghìn`;
    
    return result.trim() || `${price}đ`;
  }

  /**
   * Build description cho product để embed
   * Chỉ bao gồm thuộc tính cần sự TƯƠNG ĐỐI (không bao gồm giá, year, gender)
   */
  buildProductDescription(
    product: any,
    brandName: string,
    categoryName: string,
    scentNotes: string[],
    olfactoryFamilies: string[],
    concentrationName: string,
    variants: any[]
  ): string {
    // Lấy thông tin longevity/sillage từ variant đầu tiên có giá trị
    const variantWithStats = variants.find(v => v.longevity > 0 || v.sillage > 0);
    const longevity = variantWithStats?.longevity || 0;
    const sillage = variantWithStats?.sillage || 0;

    // Lấy giá thấp nhất
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

    // Strip HTML để vector model ko bị noise bởi tag
    return TextNormalizer.stripHtml(descriptionText);
  }

  /**
   * Build structured search text cho BM25
   * Format: "name: [Name] brand: [Brand] ..."
   */
  buildStructuredSearchText(
    product: any,
    brandName: string,
    categoryName: string,
    scentNotes: string[],
    olfactoryFamilies: string[],
    variants: any[]
  ): string {
    // Normalize các field quan trọng
    const cleanName = TextNormalizer.clean(product.Name);
    const cleanBrand = TextNormalizer.clean(brandName);
    const cleanCategory = TextNormalizer.clean(categoryName);
    const cleanGender = TextNormalizer.clean(this.localizeGender(product.Gender));
    const cleanOrigin = TextNormalizer.clean(product.Origin);
    const cleanNotes = scentNotes.map(n => TextNormalizer.clean(n)).join(', ');
    const cleanFamilies = olfactoryFamilies.map(f => TextNormalizer.clean(f)).join(', ');
    const cleanDesc = TextNormalizer.clean(product.Description);

    // Lấy giá thấp nhất cho BM25
    const minPrice = Math.min(...variants.map(v => v.BasePrice || 0));
    const priceText = this.formatPriceToVietnamese(minPrice);
    const cleanPriceText = TextNormalizer.clean(priceText);

    // Boost keywords: Lặp lại Tên + Brand + Gender để tăng trọng số BM25
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

  /**
   * Generate embedding cho text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    return await this.fptEmbeddingService.generateEmbedding(text);
  }

  /**
   * Upsert embedding cho product
   * Uses raw SQL to properly handle pgvector type serialization
   */
  async upsertEmbedding(
    productId: string,
    vector: number[],
    description: string,
    searchText?: string
  ): Promise<void> {
    // Format vector as string for pgvector: '[0.1, 0.2, 0.3, ...]'
    const vectorString = `[${vector.join(',')}]`;

    // Use raw SQL with MikroORM's parameter binding (? placeholders)
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

  /**
   * Rebuild embedding cho 1 product
   */
  async rebuildProductEmbedding(productId: string): Promise<boolean> {
    try {
      // Fetch product từ Prisma
      const product = await this.prisma.products.findFirst({
        where: {
          Id: productId,
          IsDeleted: false,
        },
        include: {
          Brands: true,
          Categories: true,
          ProductNoteMaps: {
            include: { ScentNotes: true }
          },
          ProductFamilyMaps: {
            include: { OlfactoryFamilies: true }
          },
          ProductVariants: {
            where: { IsDeleted: false },
            include: {
              Concentrations: true,
              ProductAttributes: {
                include: {
                  Attributes: true,
                  AttributeValues: true
                }
              }
            }
          },
          Media: {
            where: { IsPrimary: true }
          }
        }
      });

      if (!product) {
        console.error(`[EmbeddingService] Product not found: ${productId}`);
        return false;
      }

      // Build description
      const scentNotes = product.ProductNoteMaps.map(pnm => pnm.ScentNotes.Name);
      const olfactoryFamilies = product.ProductFamilyMaps.map(pfm => pfm.OlfactoryFamilies.Name);
      const concentrationName = product.ProductVariants[0]?.Concentrations.Name || 'N/A';

      const description = this.buildProductDescription(
        product,
        product.Brands.Name,
        product.Categories.Name,
        scentNotes,
        olfactoryFamilies,
        concentrationName,
        product.ProductVariants
      );

      // Build structured search text for BM25
      const searchText = this.buildStructuredSearchText(
        product,
        product.Brands.Name,
        product.Categories.Name,
        scentNotes,
        olfactoryFamilies,
        product.ProductVariants
      );

      // Generate embedding
      const vector = await this.generateEmbedding(description);

      // Upsert
      await this.upsertEmbedding(product.Id, vector, description, searchText);

      console.log(`[EmbeddingService] Rebuilt embedding for product: ${productId}`);
      return true;
    } catch (error) {
      console.error(`[EmbeddingService] Error rebuilding embedding for ${productId}:`, error);
      return false;
    }
  }

  /**
   * Rebuild tất cả embeddings
   */
  async rebuildAllEmbeddings(): Promise<{ success: number; failed: number }> {
    try {
      // Fetch tất cả products
      const products = await this.prisma.products.findMany({
        where: {
          IsDeleted: false,
        },
        select: { Id: true }
      });

      let success = 0;
      let failed = 0;

      for (const product of products) {
        const successResult = await this.rebuildProductEmbedding(product.Id);
        if (successResult) {
          success++;
        } else {
          failed++;
        }

        // Delay để tránh rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`[EmbeddingService] Rebuilt ${success} embeddings, ${failed} failed`);
      return { success, failed };
    } catch (error) {
      console.error('[EmbeddingService] Error rebuilding all embeddings:', error);
      return { success: 0, failed: 0 };
    }
  }

  /**
   * Vector search với pgvector cosine similarity
   */
  async vectorSearch(queryEmbedding: number[], limit: number): Promise<{ productId: string; similarity: number }[]> {
    try {
      // Raw SQL query với pgvector
      const result = await this.em
        .getConnection()
        .execute(
          `
          SELECT product_id, 1 - (vector <=> ?::vector(1024)) AS similarity 
          FROM "product_embeddings" 
          WHERE is_active = true
          ORDER BY vector <=> ?::vector(1024) 
          LIMIT ?
        `,
          [JSON.stringify(queryEmbedding), JSON.stringify(queryEmbedding), limit]
        );

      const rows = Array.isArray(result) ? result : (result as any)?.rows ?? [];

      return rows.map((row: any) => ({
        productId: row.product_id,
        similarity: parseFloat(row.similarity)
      }));
    } catch (error) {
      console.error('[EmbeddingService] Vector search error:', error);
      return [];
    }
  }

  /**
   * Search products bằng vector embedding
   */
  async searchProductsByVector(queryText: string, limit: number): Promise<any[]> {
    try {
      // Generate embedding
      const queryEmbedding = await this.generateEmbedding(queryText);

      // Vector search
      const results = await this.vectorSearch(queryEmbedding, limit);

      if (results.length === 0) {
        return [];
      }

      // Fetch products từ Prisma
      const productIds = results.map(r => r.productId);
      const products = await this.prisma.products.findMany({
        where: {
          Id: { in: productIds },
          IsDeleted: false,
        },
        include: {
          Brands: true,
          Categories: true,
          ProductVariants: {
            where: { IsDeleted: false },
            include: {
              Concentrations: true,
              Stocks: true,
              Media: {
                where: { IsPrimary: true },
                select: {
                  Id: true,
                  Url: true,
                  AltText: true,
                  IsPrimary: true,
                  DisplayOrder: true
                }
              },
              ProductAttributes: {
                include: {
                  Attributes: true,
                  AttributeValues: true
                }
              }
            },
            orderBy: { BasePrice: 'asc' }
          },
          ProductNoteMaps: {
            include: { ScentNotes: true }
          },
          ProductFamilyMaps: {
            include: { OlfactoryFamilies: true }
          },
          ProductAttributes: {
            include: {
              Attributes: true,
              AttributeValues: true
            }
          },
          Media: {
            where: { IsPrimary: true }
          }
        }
      });

      // Map similarity vào products
      const similarityMap = new Map(results.map(r => [r.productId, r.similarity]));
      return products.map(product => ({
        ...product,
        similarity: similarityMap.get(product.Id) || 0
      })).sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      console.error('[EmbeddingService] Search by vector error:', error);
      return [];
    }
  }

  /**
   * Get stats về embeddings
   */
  async getEmbeddingsStats(): Promise<{ total: number; lastRebuild?: string }> {
    try {
      const result = await this.em
        .getConnection()
        .execute(
          `
          SELECT COUNT(*) as total, MAX(updated_at) as lastRebuild
          FROM "product_embeddings"
        `
        );

      const rows = Array.isArray(result) ? result : (result as any)?.rows ?? [];
      const row = rows[0] ?? { total: 0, lastRebuild: null };
      return {
        total: parseInt(row.total),
        lastRebuild: row.lastRebuild ? new Date(row.lastRebuild).toISOString() : undefined
      };
    } catch (error) {
      console.error('[EmbeddingService] Get stats error:', error);
      return { total: 0 };
    }
  }
}
