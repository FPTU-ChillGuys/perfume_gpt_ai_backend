import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { QueryNormalizerOrchestrator, NormalizedQueryFilters } from './normalizers/orchestrator';
import { EmbeddingService } from './embedding.service';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { ProductWithVariantsResponse } from 'src/application/dtos/response/product-with-variants.response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response cho Hybrid Search v4
 */
export class HybridSearchResponse extends PagedResult<ProductWithVariantsResponse> {
  /** Danh sách bản ghi */
  @ApiProperty({ description: 'Danh sách bản ghi', type: () => [ProductWithVariantsResponse] })
  declare items: ProductWithVariantsResponse[];

  /** Bộ lọc query đã extract */
  @ApiPropertyOptional({ description: 'Filters found in query', type: () => NormalizedQueryFilters, nullable: true })
  queryFilters?: NormalizedQueryFilters | null;

  /** Có sử dụng vector similarity không */
  @ApiProperty({ description: 'Whether vector similarity was used' })
  vectorSimilarity?: boolean;
}


/**
 * HybridSearchService - Orchestrator cho Hybrid Search v4
 * Kết hợp Query Layer (hard filters) và Vector Layer (similarity search)
 */
@Injectable()
export class HybridSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly embeddingService: EmbeddingService,
    private readonly queryNormalizer: QueryNormalizerOrchestrator
  ) { }

  /**
   * Search products bằng Hybrid Search v4
   * 1. Query Layer: Phân tích và filter bằng hard filters (giá, gender, year, origin)
   * 2. Vector Layer: Tìm similarity bằng vector embeddings
   * 3. Merge: Intersection của query results và vector results, sort theo similarity
   * 
   * @param searchText - Text tìm kiếm
   * @param request - Pagination & sorting request
   * @returns PagedResult với products sorted theo vector similarity
   */
  async search(
    searchText: string,
    request: PagedAndSortedRequest
  ): Promise<BaseResponseAPI<HybridSearchResponse>> {
    try {
      const pageNumber = request.PageNumber || 1;
      const pageSize = request.PageSize || 10;

      // ====== Bước 1: Query Layer ======
      // Phân tích và chuẩn hóa filters
      let queryFilters = await this.queryNormalizer.normalize(searchText);

      const isSemanticOnly = this.configService.get<string>('SEARCH_SEMANTIC_ONLY') === 'true';

      if (isSemanticOnly && queryFilters) {
        console.log('[HybridSearch] Semantic Only mode enabled. Disabling all filters except Gender.');
        // Chỉ giữ lại giới tính trong queryFilters
        queryFilters = {
          gender: queryFilters.gender,
          // Xóa các cái khác
          price: undefined,
          year: undefined,
          origin: undefined
        };
      }

      let queryResultIds: Set<string> | null = null;

      if (queryFilters) {
        // Build Prisma WHERE clause từ filters
        const whereClause = this.buildWhereClause(queryFilters);

        // Execute query để lấy product IDs
        const queryProducts = await this.prisma.products.findMany({
          where: whereClause,
          select: { Id: true },
          distinct: ['Id']
        });

        queryResultIds = new Set(queryProducts.map(p => p.Id));

        console.log(`[HybridSearch] Query layer found ${queryResultIds.size} products with filters ${isSemanticOnly ? '(Gender only)' : ''}`);
      }

      // ====== Bước 2: Vector Layer ======
      // Generate embedding và vector search
      const vectorLimit = pageSize * 3; // Lấy dư để filter
      const vectorResults = await this.embeddingService.searchProductsByVector(searchText, vectorLimit);

      console.log(`[HybridSearch] Vector layer found ${vectorResults.length} products by similarity`);

      // ====== Bước 3: Merge ======
      // Nếu có query filters, filter vector results (intersection)
      let mergedResults: any[] = [];

      if (queryResultIds && queryResultIds.size > 0) {
        // Intersection: chỉ giữ products có productId trong queryResultIds
        mergedResults = vectorResults.filter(v => queryResultIds.has(v.Id));

        console.log(`[HybridSearch] After intersection: ${mergedResults.length} products`);

        // Nếu intersection rỗng -> trả về empty (theo decision)
        if (mergedResults.length === 0) {
          return {
            success: true,
            payload: this.createEmptyResponse(pageNumber, pageSize)
          };
        }
      } else {
        // Không có query filters -> giữ toàn bộ vector results
        mergedResults = vectorResults;
      }

      // Sort theo similarity (đã được sort từ vector search)
      mergedResults.sort((a, b) => b.similarity - a.similarity);

      // ====== Bước 4: Pagination ======
      const startIndex = (pageNumber - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedResults = mergedResults.slice(startIndex, endIndex);

      // ====== Bước 5: Format response ======
      const items = paginatedResults.map(product => this.mapToProductResponse(product, queryFilters || undefined));

      const response: HybridSearchResponse = {
        items,
        pageNumber,
        pageSize,
        totalCount: mergedResults.length,
        totalPages: Math.ceil(mergedResults.length / pageSize),
        hasPreviousPage: pageNumber > 1,
        hasNextPage: endIndex < mergedResults.length,
        queryFilters,
        vectorSimilarity: true
      };

      return {
        success: true,
        payload: response
      };
    } catch (error) {
      console.error('[HybridSearch] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build Prisma WHERE clause từ NormalizedQueryFilters
   */
  private buildWhereClause(filters: NormalizedQueryFilters): any {
    const conditions: any[] = [];

    // Price filter
    if (filters.price) {
      const { min, max, operator } = filters.price;

      if (operator === 'lte' || operator === 'lt') {
        conditions.push({
          ProductVariants: {
            some: {
              BasePrice: operator === 'lte' ? { lte: max } : { lt: max },
              IsDeleted: false
            }
          }
        });
      } else if (operator === 'gte' || operator === 'gt') {
        conditions.push({
          ProductVariants: {
            some: {
              BasePrice: operator === 'gte' ? { gte: min } : { gt: min },
              IsDeleted: false
            }
          }
        });
      } else if (operator === 'between') {
        conditions.push({
          ProductVariants: {
            some: {
              BasePrice: {
                gte: min,
                lte: max
              },
              IsDeleted: false
            }
          }
        });
      }
    }

    // Gender filter
    if (filters.gender?.value) {
      conditions.push({
        Gender: filters.gender.value
      });
    }

    // Year filter
    if (filters.year) {
      const { year, operator } = filters.year;

      if (operator === 'eq') {
        conditions.push({ ReleaseYear: year });
      } else if (operator === 'gte') {
        conditions.push({ ReleaseYear: { gte: year } });
      } else if (operator === 'lte') {
        conditions.push({ ReleaseYear: { lte: year } });
      } else if (operator === 'newer') {
        conditions.push({ ReleaseYear: { gte: year } });
      } else if (operator === 'older') {
        conditions.push({ ReleaseYear: { lte: year } });
      }
    }

    // Origin filter
    if (filters.origin?.origins && filters.origin.origins.length > 0) {
      conditions.push({
        Origin: {
          in: filters.origin.origins
        }
      });
    }

    // Nếu có nhiều conditions thì AND lại
    if (conditions.length === 0) {
      return { IsDeleted: false };
    } else if (conditions.length === 1) {
      return { ...conditions[0], IsDeleted: false };
    } else {
      return {
        AND: conditions,
        IsDeleted: false
      };
    }
  }

  /**
   * Map product từ Prisma sang ProductWithVariantsResponse
   */
  private mapToProductResponse(product: any, filters?: NormalizedQueryFilters): ProductWithVariantsResponse {
    let variants = product.ProductVariants || [];

    // Filter variants based on price filters if present
    if (filters?.price) {
      const { min, max, operator } = filters.price;
      variants = variants.filter((v: any) => {
        const price = Number(v.BasePrice);
        if (operator === 'lte' || operator === 'lt') {
          return operator === 'lte' ? price <= (max as number) : price < (max as number);
        } else if (operator === 'gte' || operator === 'gt') {
          return operator === 'gte' ? price >= (min as number) : price > (min as number);
        } else if (operator === 'between') {
          return price >= (min as number) && price <= (max as number);
        }
        return true;
      });
    }

    // Sort variants by price ascending so the first one is the cheapest
    variants.sort((a: any, b: any) => Number(a.BasePrice) - Number(b.BasePrice));

    return {
      id: product.Id,
      name: product.Name,
      brandId: product.BrandId,
      brandName: product.Brands.Name,
      categoryId: product.CategoryId,
      categoryName: product.Categories.Name,
      description: product.Description,
      primaryImage: product.Media[0]?.Url || null,
      variants: variants.map(v => ({
        id: v.Id,
        productId: v.ProductId,
        sku: v.Sku,
        barcode: v.Barcode,
        volumeMl: v.VolumeMl,
        type: v.Type,
        basePrice: Number(v.BasePrice),
        retailPrice: v.RetailPrice ? Number(v.RetailPrice) : null,
        status: v.Status,
        concentrationId: v.ConcentrationId,
        longevity: v.Longevity,
        sillage: v.Sillage,
        concentration: {
          id: v.Concentrations.Id,
          name: v.Concentrations.Name
        },
        stock: null,
        attributes: (v.ProductAttributes ?? []).map((pa: any) => ({
          id: pa.Id,
          attributeId: pa.AttributeId,
          attributeName: pa.Attributes?.Name,
          valueId: pa.ValueId,
          attribute: pa.Attributes?.Name ?? '',
          description: pa.Attributes?.Description ?? '',
          value: pa.AttributeValues?.Value ?? '',
          valueName: pa.AttributeValues?.Value
        })),
        media: v.Media.map(m => ({
          id: m.Id,
          mediaUrl: m.MediaUrl,
          url: m.MediaUrl,
          altText: null,
          isPrimary: m.IsPrimary,
          displayOrder: m.DisplayOrder ?? 0
        })),
        createdAt: v.CreatedAt ? new Date(v.CreatedAt).toISOString() : new Date(0).toISOString(),
        updatedAt: v.UpdatedAt ? new Date(v.UpdatedAt).toISOString() : null
      })),
      scentNotes: product.ProductNoteMaps.map(pnm => pnm.ScentNotes.Name),
      olfactoryFamilies: product.ProductFamilyMaps.map(pfm => pfm.OlfactoryFamilies.Name),
      attributes: product.ProductAttributes.map(pa => ({
        id: pa.Id,
        attributeId: pa.AttributeId,
        valueId: pa.ValueId,
        attributeName: pa.Attributes.Name,
        attribute: pa.Attributes.Name,
        description: pa.Attributes.Description ?? '',
        value: pa.AttributeValues.Value,
        valueName: pa.AttributeValues.Value
      })),
      createdAt: product.CreatedAt ? new Date(product.CreatedAt).toISOString() : new Date(0).toISOString(),
      updatedAt: product.UpdatedAt ? new Date(product.UpdatedAt).toISOString() : null
    };
  }

  /**
   * Tạo empty response
   */
  private createEmptyResponse(pageNumber: number, pageSize: number): HybridSearchResponse {
    return {
      items: [],
      pageNumber,
      pageSize,
      totalCount: 0,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false,
      queryFilters: undefined,
      vectorSimilarity: false
    };
  }
}
