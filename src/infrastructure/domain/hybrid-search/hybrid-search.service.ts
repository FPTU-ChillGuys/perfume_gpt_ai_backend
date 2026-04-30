import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryNormalizerOrchestrator, NormalizedQueryFilters } from './normalizers/orchestrator';
import { PriceNormalizerOutput } from './normalizers/price.normalizer';
import { EmbeddingService } from './embedding.service';
import { RerankService } from '../ai/rerank.service';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { HybridSearchResponse } from 'src/application/dtos/response/hybrid-search/hybrid-search.response';
import { VectorSearchResult } from 'src/application/dtos/response/hybrid-search/hybrid-search.types';
import { ProductWithVariantsResponse } from 'src/application/dtos/response/product-with-variants.response';
import { HYBRID_SEARCH_CONFIG } from 'src/application/constant/hybrid-search.config';

import { Prisma } from 'generated/prisma/client';

type ProductWithIncludes = Prisma.ProductsGetPayload<{
  include: {
    Brands: true;
    Categories: true;
    ProductVariants: {
      where: { IsDeleted: false };
      include: {
        Concentrations: true;
        Media: { where: { IsPrimary: true } };
        ProductAttributes: { include: { Attributes: true; AttributeValues: true } };
      };
      orderBy: { BasePrice: 'asc' };
    };
    ProductNoteMaps: { include: { ScentNotes: true } };
    ProductFamilyMaps: { include: { OlfactoryFamilies: true } };
    ProductAttributes: { include: { Attributes: true; AttributeValues: true } };
    Media: { where: { IsPrimary: true } };
  };
}>;

@Injectable()
export class HybridSearchService {
  private readonly logger = new Logger(HybridSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly queryNormalizer: QueryNormalizerOrchestrator,
    private readonly rerankService: RerankService
  ) {}

  async search(
    searchText: string,
    request: PagedAndSortedRequest
  ): Promise<BaseResponseAPI<HybridSearchResponse>> {
    try {
      const pageNumber = request.PageNumber || 1;
      const pageSize = request.PageSize || 10;

      const queryFilters = await this.queryNormalizer.normalize(searchText);
      const hardFilterIds = await this.resolveHardFilterIds(queryFilters);
      if (hardFilterIds?.length === 0) {
        return { success: true, payload: this.createEmptyResponse(pageNumber, pageSize) };
      }

      const embeddingString = `[${(await this.embeddingService.generateEmbedding(searchText)).join(',')}]`;

      const { bm25Ids, vectorData } = await this.executeHybridRetrieval(
        searchText, embeddingString, hardFilterIds
      );

      const candidateIds = this.intersectCandidateIds(bm25Ids, vectorData);
      this.logger.log(`BM25: ${bm25Ids.length}, Vector: ${vectorData.length}, Intersection: ${candidateIds.length}`);

      if (candidateIds.length === 0) {
        return { success: true, payload: this.createEmptyResponse(pageNumber, pageSize) };
      }

      const products = await this.fetchProductDetails(candidateIds);
      const rerankedProducts = await this.rerankAndFilter(searchText, products);
      if (rerankedProducts.length === 0) {
        return { success: true, payload: this.createEmptyResponse(pageNumber, pageSize) };
      }

      return this.buildPaginatedResponse(
        rerankedProducts, queryFilters, pageNumber, pageSize
      );
    } catch (error) {
      this.logger.error('Hybrid search error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async resolveHardFilterIds(
    filters: NormalizedQueryFilters | null
  ): Promise<string[] | null> {
    if (!filters) return null;
    const whereClause = this.buildWhereClause(filters);
    const filteredProducts = await this.prisma.products.findMany({
      where: whereClause,
      select: { Id: true },
      distinct: ['Id']
    });
    return filteredProducts.map(p => p.Id);
  }

  private async executeHybridRetrieval(
    searchText: string,
    embeddingString: string,
    hardFilterIds: string[] | null
  ): Promise<{ bm25Ids: string[]; vectorData: VectorSearchResult[] }> {
    const limit = HYBRID_SEARCH_CONFIG.RETRIEVAL_LIMIT;
    const filterClause = hardFilterIds ? 'AND product_id = ANY(?::uuid[])' : '';
    const params: unknown[] = [];

    const bm25Params: unknown[] = [];
    if (hardFilterIds) bm25Params.push(hardFilterIds);
    bm25Params.push(searchText, limit);

    const bm25Result = await this.embeddingService.em.getConnection().execute(
      `SELECT product_id FROM product_embeddings WHERE is_active = true ${filterClause} ORDER BY search_text <@> ? LIMIT ?`,
      bm25Params
    );
    const bm25Rows = this.extractRows(bm25Result);
    const bm25Ids = bm25Rows.map(r => r.product_id as string);

    const vectorParams: unknown[] = [embeddingString];
    if (hardFilterIds) vectorParams.push(hardFilterIds);
    vectorParams.push(embeddingString, limit);

    const vectorResult = await this.embeddingService.em.getConnection().execute(
      `SELECT product_id, 1 - (vector <=> ?::vector(1024)) as similarity FROM product_embeddings WHERE is_active = true ${filterClause} ORDER BY vector <=> ?::vector(1024) LIMIT ?`,
      vectorParams
    );
    const vectorRows = this.extractRows(vectorResult);
    const vectorData: VectorSearchResult[] = vectorRows.map(r => ({
      productId: r.product_id as string,
      similarity: parseFloat(r.similarity as string)
    }));

    return { bm25Ids, vectorData };
  }

  private intersectCandidateIds(bm25Ids: string[], vectorData: VectorSearchResult[]): string[] {
    const vectorIdSet = new Set(vectorData.map(v => v.productId));
    return bm25Ids.filter(id => vectorIdSet.has(id));
  }

  private async fetchProductDetails(candidateIds: string[]): Promise<ProductWithIncludes[]> {
    return this.prisma.products.findMany({
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

  private async rerankAndFilter(
    searchText: string,
    products: ProductWithIncludes[]
  ): Promise<ProductWithIncludes[]> {
    const candidates = products.map(p => ({
      ...p,
      text: `name: ${p.Name} brand: ${p.Brands.Name} category: ${p.Categories.Name} notes: ${p.ProductNoteMaps.map(n => n.ScentNotes.Name).join(', ')} families: ${p.ProductFamilyMaps.map(f => f.OlfactoryFamilies.Name).join(', ')} description: ${p.Description || ''}`
    }));

    const reranked = await this.rerankService.rerank(
      searchText, candidates, HYBRID_SEARCH_CONFIG.RETRIEVAL_LIMIT
    );

    const productMap = new Map(products.map(p => [p.Id, p]));
    return reranked
      .filter(r => r.rerankScore >= HYBRID_SEARCH_CONFIG.RERANK_THRESHOLD)
      .map(r => productMap.get(r.Id))
      .filter((p): p is ProductWithIncludes => p !== undefined);
  }

  private buildPaginatedResponse(
    rerankedProducts: ProductWithIncludes[],
    queryFilters: NormalizedQueryFilters | null | undefined,
    pageNumber: number,
    pageSize: number
  ): BaseResponseAPI<HybridSearchResponse> {
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginated = rerankedProducts.slice(startIndex, endIndex);

    const items = paginated.map(p => this.mapToProductResponse(p, queryFilters || undefined));

    const response: HybridSearchResponse = {
      items,
      pageNumber,
      pageSize,
      totalCount: rerankedProducts.length,
      totalPages: Math.ceil(rerankedProducts.length / pageSize),
      hasPreviousPage: pageNumber > 1,
      hasNextPage: endIndex < rerankedProducts.length,
      queryFilters,
      vectorSimilarity: true
    };

    return { success: true, payload: response };
  }

  private buildWhereClause(filters: NormalizedQueryFilters): Prisma.ProductsWhereInput {
    const conditions: Prisma.ProductsWhereInput[] = [];

    this.applyPriceFilter(filters, conditions);
    this.applyGenderFilter(filters, conditions);
    this.applyYearFilter(filters, conditions);
    this.applyOriginFilter(filters, conditions);

    if (conditions.length === 0) {
      return { IsDeleted: false };
    }
    if (conditions.length === 1) {
      return { ...conditions[0], IsDeleted: false };
    }
    return { AND: conditions, IsDeleted: false };
  }

  private applyPriceFilter(filters: NormalizedQueryFilters, conditions: Prisma.ProductsWhereInput[]): void {
    if (!filters.price) return;
    const { min, max, operator } = filters.price;

    if (operator === 'lte' || operator === 'lt') {
      conditions.push({
        ProductVariants: { some: { BasePrice: operator === 'lte' ? { lte: max } : { lt: max }, IsDeleted: false } }
      });
    } else if (operator === 'gte' || operator === 'gt') {
      conditions.push({
        ProductVariants: { some: { BasePrice: operator === 'gte' ? { gte: min } : { gt: min }, IsDeleted: false } }
      });
    } else if (operator === 'between') {
      conditions.push({
        ProductVariants: { some: { BasePrice: { gte: min, lte: max }, IsDeleted: false } }
      });
    }
  }

  private applyGenderFilter(filters: NormalizedQueryFilters, conditions: Prisma.ProductsWhereInput[]): void {
    if (!filters.gender?.value) return;
    const genderMap: Record<string, string> = { 'Nam': 'Male', 'Nữ': 'Female' };
    conditions.push({ Gender: genderMap[filters.gender.value] ?? filters.gender.value });
  }

  private applyYearFilter(filters: NormalizedQueryFilters, conditions: Prisma.ProductsWhereInput[]): void {
    if (!filters.year) return;
    const { year, operator } = filters.year;
    const yearConditions: Record<string, Prisma.IntFilter> = {
      eq: { equals: year },
      gte: { gte: year },
      lte: { lte: year },
      newer: { gte: year },
      older: { lte: year }
    };
    const cond = yearConditions[operator ?? 'eq'];
    if (cond) conditions.push({ ReleaseYear: cond });
  }

  private applyOriginFilter(filters: NormalizedQueryFilters, conditions: Prisma.ProductsWhereInput[]): void {
    if (!filters.origin?.origins?.length) return;
    conditions.push({ Origin: { in: filters.origin.origins } });
  }

  private mapToProductResponse(product: ProductWithIncludes, filters?: NormalizedQueryFilters): ProductWithVariantsResponse {
    let variants = product.ProductVariants || [];
    variants = this.filterVariantsByPrice(variants, filters?.price);
    variants.sort((a, b) => Number(a.BasePrice) - Number(b.BasePrice));

    return {
      id: product.Id,
      name: product.Name,
      brandId: product.BrandId,
      brandName: product.Brands.Name,
      categoryId: product.CategoryId,
      categoryName: product.Categories.Name,
      description: product.Description ?? undefined,
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
        concentration: { id: v.Concentrations.Id, name: v.Concentrations.Name },
        stock: null,
        attributes: (v.ProductAttributes ?? []).map(pa => ({
          id: pa.Id,
          attributeId: pa.AttributeId,
          attributeName: pa.Attributes?.Name,
          valueId: pa.ValueId,
          attribute: pa.Attributes?.Name ?? '',
          description: pa.Attributes?.Description ?? '',
          value: pa.AttributeValues?.Value ?? '',
          valueName: pa.AttributeValues?.Value
        })),
        url: v.Media?.find(m => m.IsPrimary)?.Url || v.Media?.[0]?.Url || null,
        media: (v.Media ?? []).map(m => ({
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

  private filterVariantsByPrice(
    variants: ProductWithIncludes['ProductVariants'],
    priceFilter?: PriceNormalizerOutput
  ): ProductWithIncludes['ProductVariants'] {
    if (!priceFilter) return variants;
    const { min, max, operator } = priceFilter;
    return variants.filter(v => {
      const price = Number(v.BasePrice);
      if (operator === 'lte' || operator === 'lt') {
        return operator === 'lte' ? price <= (max as number) : price < (max as number);
      }
      if (operator === 'gte' || operator === 'gt') {
        return operator === 'gte' ? price >= (min as number) : price > (min as number);
      }
      if (operator === 'between') {
        return price >= (min as number) && price <= (max as number);
      }
      return true;
    });
  }

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

  private extractRows(result: unknown): Record<string, unknown>[] {
    if (Array.isArray(result)) return result as Record<string, unknown>[];
    const obj = result as Record<string, unknown>;
    if (obj?.rows && Array.isArray(obj.rows)) return obj.rows as Record<string, unknown>[];
    return [];
  }
}