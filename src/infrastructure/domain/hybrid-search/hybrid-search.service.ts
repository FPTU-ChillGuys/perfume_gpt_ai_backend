import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { QueryNormalizerOrchestrator, NormalizedQueryFilters } from './normalizers/orchestrator';
import { EmbeddingService } from './embedding.service';
import { RerankService } from '../ai/rerank.service';
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
    private readonly queryNormalizer: QueryNormalizerOrchestrator,
    private readonly rerankService: RerankService
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

      // 1. Query Layer (Hard Filters)
      const queryFilters = await this.queryNormalizer.normalize(searchText);
      const hardFilterIds = await this.applyHardFilters(queryFilters);

      if (hardFilterIds && hardFilterIds.length === 0) {
        return { success: true, payload: this.createEmptyResponse(pageNumber, pageSize) };
      }

      // 2. Hybrid Retrieval (Vector + BM25)
      const candidateIds = await this.performHybridRetrieval(searchText, hardFilterIds);

      if (candidateIds.length === 0) {
        return { success: true, payload: this.createEmptyResponse(pageNumber, pageSize) };
      }

      // 3. Fetch candidate details
      const products = await this.fetchCandidateDetails(candidateIds);

      // 4. Reranking & Filtering
      const filteredResults = await this.rerankAndFilter(searchText, products, 10);

      // 5. Build Response
      const response = this.buildPaginatedResponse(filteredResults, pageNumber, pageSize, queryFilters);

      return { success: true, payload: response };
    } catch (error) {
      console.error('[HybridSearch] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Bước 1: Query Layer (Hard Filters)
   * Phân tích query và lấy IDs của các sản phẩm thỏa mãn tiêu chí cứng (giá, giới tính, v.v.)
   */
  private async applyHardFilters(queryFilters: NormalizedQueryFilters | null): Promise<string[] | null> {
    if (!queryFilters) return null;

    const whereClause = this.buildWhereClause(queryFilters);
    const filteredProducts = await this.prisma.products.findMany({
      where: whereClause,
      select: { Id: true },
      distinct: ['Id']
    });

    return filteredProducts.map(p => p.Id);
  }

  /**
   * Bước 2: Hybrid Retrieval (Vector + BM25)
   * Tìm kiếm ứng viên bằng cả Vector Similarity và Keyword Matching (BM25-ish)
   */
  private async performHybridRetrieval(searchText: string, hardFilterIds: string[] | null): Promise<string[]> {
    const queryEmbedding = await this.embeddingService.generateEmbedding(searchText);
    const embeddingString = `[${queryEmbedding.join(',')}]`;
    const retrievalLimit = 10;

    // 1. Get BM25 Candidates
    const bm25Params: any[] = [];
    if (hardFilterIds) bm25Params.push(hardFilterIds);
    bm25Params.push(searchText);
    bm25Params.push(retrievalLimit);

    const bm25Rows = await this.embeddingService.em.getConnection().execute(`
      SELECT product_id 
      FROM product_embeddings 
      WHERE is_active = true 
      ${hardFilterIds ? 'AND product_id IN (?)' : ''}
      ORDER BY search_text <@> ?
      LIMIT ?
    `, bm25Params);

    // 2. Get Vector Candidates
    const vectorParams: any[] = [];
    vectorParams.push(embeddingString);
    if (hardFilterIds) vectorParams.push(hardFilterIds);
    vectorParams.push(embeddingString);
    vectorParams.push(retrievalLimit);

    const vectorRows = await this.embeddingService.em.getConnection().execute(`
      SELECT product_id, 1 - (vector <=> ?::vector(1024)) as similarity 
      FROM product_embeddings 
      WHERE is_active = true 
      ${hardFilterIds ? 'AND product_id IN (?)' : ''}
      ORDER BY vector <=> ?::vector(1024)
      LIMIT ?
    `, vectorParams);

    const bm25Ids = (Array.isArray(bm25Rows) ? bm25Rows : (bm25Rows as any)?.rows ?? []).map((r: any) => r.product_id);
    const vectorData = (Array.isArray(vectorRows) ? vectorRows : (vectorRows as any)?.rows ?? []);
    const vectorIds = vectorData.map((r: any) => r.product_id);

    // 3. Intersection Merge (Giao của 2 mảng)
    const candidateIds = bm25Ids.filter(id => vectorIds.includes(id));

    console.log(`[HybridSearch] BM25 found ${bm25Ids.length} candidates`);
    console.log(`[HybridSearch] Vector found ${vectorIds.length} candidates (top score: ${vectorData[0]?.similarity || 0})`);
    console.log(`[HybridSearch] Intersection candidates (Giao): ${candidateIds.length}`);

    return candidateIds;
  }

  /**
   * Bước 3: Fetch candidate details
   * Lấy thông tin chi tiết các sản phẩm từ database
   */
  private async fetchCandidateDetails(candidateIds: string[]) {
    return await this.prisma.products.findMany({
      where: { Id: { in: candidateIds }, IsDeleted: false },
      include: {
        Brands: true,
        Categories: true,
        ProductVariants: {
          where: { IsDeleted: false },
          include: {
            Concentrations: true,
            Media: { where: { IsPrimary: true } },
            ProductAttributes: { include: { Attributes: true, AttributeValues: true } }
          },
          orderBy: { BasePrice: 'asc' }
        },
        ProductNoteMaps: { include: { ScentNotes: true } },
        ProductFamilyMaps: { include: { OlfactoryFamilies: true } },
        ProductAttributes: { include: { Attributes: true, AttributeValues: true } },
        Media: { where: { IsPrimary: true } }
      }
    });
  }

  /**
   * Bước 4: Reranking & Filtering
   * Sử dụng AI Reranker để đánh giá lại độ liên quan và lọc bỏ kết quả điểm thấp
   */
  private async rerankAndFilter(searchText: string, products: any[], retrievalLimit: number) {
    const rerankCandidates = products.map(p => {
      const scentNotes = p.ProductNoteMaps.map(n => n.ScentNotes.Name).join(', ');
      const families = p.ProductFamilyMaps.map(f => f.OlfactoryFamilies.Name).join(', ');
      return {
        ...p,
        text: `name: ${p.Name} brand: ${p.Brands.Name} category: ${p.Categories.Name} notes: ${scentNotes} families: ${families} description: ${p.Description || ''}`
      };
    });

    const rerankedResults = await this.rerankService.rerank(searchText, rerankCandidates, retrievalLimit);

    const threshold = 0.2;
    const filteredResults = rerankedResults.filter(r => r.rerankScore >= threshold);
    console.log(`[HybridSearch] Reranked ${rerankedResults.length} items, ${filteredResults.length} passed threshold ${threshold}`);

    return filteredResults;
  }

  /**
   * Bước 5: Build Response
   * Phân trang và map sang DTO response
   */
  private buildPaginatedResponse(
    filteredResults: any[],
    pageNumber: number,
    pageSize: number,
    queryFilters: NormalizedQueryFilters | null
  ): HybridSearchResponse {
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedResults = filteredResults.slice(startIndex, endIndex);

    const items = paginatedResults.map(product => this.mapToProductResponse(product, queryFilters || undefined));

    return {
      items,
      pageNumber,
      pageSize,
      totalCount: filteredResults.length,
      totalPages: Math.ceil(filteredResults.length / pageSize),
      hasPreviousPage: pageNumber > 1,
      hasNextPage: endIndex < filteredResults.length,
      queryFilters,
      vectorSimilarity: true
    };
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
      let dbGender = filters.gender.value as string;
      if (dbGender === 'Nam') dbGender = 'Male';
      else if (dbGender === 'Nữ') dbGender = 'Female';

      conditions.push({
        Gender: dbGender
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
        url: v.Media?.find((m: any) => m.IsPrimary)?.Url || v.Media?.[0]?.Url || null,
        media: (v.Media ?? []).map((m: any) => ({
          id: m.Id,
          url: m.Url,
          altText: m.AltText ?? null,
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
