import { Injectable, Logger, NotFoundException, Query } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import {
  ProductAttributeResponse,
  ProductResponse
} from 'src/application/dtos/response/product.response';
import {
  ConcentrationResponse,
  ProductVariantResponse,
  ProductWithVariantsResponse,
  VariantMediaResponse,
  VariantStockResponse
} from 'src/application/dtos/response/product-with-variants.response';
import { BestSellingProductResponse } from 'src/application/dtos/response/product-insight.response';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { Prisma } from 'generated/prisma/client';
import ApiUrl from 'src/infrastructure/domain/common/api/api_url';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { SearchService } from 'src/infrastructure/domain/search/search.service';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ProductCardOutputItem } from 'src/chatbot/output/product.output';
import { NlpEngineService } from 'src/infrastructure/domain/common/nlp-engine.service';
import { DictionaryBuilderService } from 'src/infrastructure/domain/common/dictionary-builder.service';
import { EntityDictionary } from 'src/domain/types/dictionary.types';
import { unescapeUnicode } from 'unescape-unicode';
import { escapeUnicode, isNotAscii } from 'escape-unicode';

const productInclude = {
  Brands: true,
  Categories: true,
  Media: { where: { IsPrimary: true } },
  ProductAttributes: {
    include: { Attributes: true, AttributeValues: true }
  }
} satisfies Prisma.ProductsInclude;

type ProductWithRelations = Prisma.ProductsGetPayload<{
  include: typeof productInclude;
}>;

// ─── include dùng cho getProductWithVariants ───────────────────────────────
const productWithVariantsInclude = {
  Brands: true,
  Categories: true,
  Media: { where: { IsPrimary: true } },
  ProductAttributes: {
    include: { Attributes: true, AttributeValues: true }
  },
  ProductVariants: {
    where: { IsDeleted: false },
    include: {
      Concentrations: true,
      Stocks: true,
      Media: true,
      ProductAttributes: {
        include: { Attributes: true, AttributeValues: true }
      }
    }
  },
  ProductNoteMaps: {
    include: { ScentNotes: true }
  },
  ProductFamilyMaps: {
    include: { OlfactoryFamilies: true }
  }
} satisfies Prisma.ProductsInclude;

type ProductWithVariantsRelations = Prisma.ProductsGetPayload<{
  include: typeof productWithVariantsInclude;
}>;

function mapProductWithVariants(
  p: ProductWithVariantsRelations
): ProductWithVariantsResponse {
  return {
    id: p.Id,
    name: p.Name,
    brandId: p.BrandId,
    brandName: p.Brands.Name,
    categoryId: p.CategoryId,
    categoryName: p.Categories.Name,
    description: p.Description ?? '',
    primaryImage: p.Media[0]?.Url ?? null,
    createdAt: p.CreatedAt.toISOString(),
    updatedAt: p.UpdatedAt?.toISOString() ?? null,
    scentNotes: p.ProductNoteMaps?.map((n: any) => n.ScentNotes?.Name).filter(Boolean) || [],
    olfactoryFamilies: p.ProductFamilyMaps?.map((f: any) => f.OlfactoryFamilies?.Name).filter(Boolean) || [],
    attributes: (p.ProductAttributes ?? []).map(
      (attr): ProductAttributeResponse => ({
        id: attr.Id,
        attributeId: attr.AttributeId,
        valueId: attr.ValueId,
        attribute: attr.Attributes.Name,
        description: attr.Attributes.Description ?? '',
        value: attr.AttributeValues.Value
      })
    ),
    variants: (p.ProductVariants ?? []).map(
      (v): ProductVariantResponse => ({
        id: v.Id,
        productId: v.ProductId,
        sku: v.Sku,
        barcode: v.Barcode,
        volumeMl: v.VolumeMl,
        type: v.Type,
        basePrice: Number(v.BasePrice),
        status: v.Status,
        concentrationId: v.ConcentrationId,
        concentration: v.Concentrations
          ? ({
            id: v.Concentrations.Id,
            name: v.Concentrations.Name
          } satisfies ConcentrationResponse)
          : null,
        stock: v.Stocks
          ? ({
            id: v.Stocks.Id,
            totalQuantity: v.Stocks.TotalQuantity,
            reservedQuantity: v.Stocks.ReservedQuantity,
            lowStockThreshold: v.Stocks.LowStockThreshold
          } satisfies VariantStockResponse)
          : null,
        media: (v.Media ?? []).map(
          (m): VariantMediaResponse => ({
            id: m.Id,
            url: m.Url,
            altText: m.AltText ?? null,
            isPrimary: m.IsPrimary,
            displayOrder: m.DisplayOrder
          })
        ),
        attributes: (v.ProductAttributes ?? []).map(
          (attr): ProductAttributeResponse => ({
            id: attr.Id,
            attributeId: attr.AttributeId,
            valueId: attr.ValueId,
            attribute: attr.Attributes.Name,
            description: attr.Attributes.Description ?? '',
            value: attr.AttributeValues.Value
          })
        ),
        longevity: v.Longevity,
        sillage: v.Sillage,
        createdAt: v.CreatedAt.toISOString(),
        updatedAt: v.UpdatedAt?.toISOString() ?? null
      })
    )
  };
}

function mapProduct(p: ProductWithRelations): ProductResponse {
  return {
    id: p.Id,
    name: p.Name,
    brandId: p.BrandId,
    brandName: p.Brands.Name,
    categoryId: p.CategoryId,
    categoryName: p.Categories.Name,
    description: p.Description ?? '',
    primaryImage: p.Media[0]?.Url ?? null,
    attributes: (p.ProductAttributes ?? []).map(
      (attr): ProductAttributeResponse => ({
        id: attr.Id,
        attributeId: attr.AttributeId,
        valueId: attr.ValueId,
        attribute: attr.Attributes.Name,
        description: attr.Attributes.Description ?? '',
        value: attr.AttributeValues.Value
      })
    )
  };
}

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    private readonly nlpEngineService: NlpEngineService,
    private readonly dictionaryBuilderService: DictionaryBuilderService,
  ) { }

  private createEmptyPagedProducts(
    request: PagedAndSortedRequest
  ): PagedResult<ProductWithVariantsResponse> {
    return new PagedResult<ProductWithVariantsResponse>({
      items: [],
      pageNumber: request.PageNumber,
      pageSize: request.PageSize,
      totalCount: 0,
      totalPages: 0
    });
  }

  private async runParsedQuerySearch(
    searchText: string,
    request: PagedAndSortedRequest
  ): Promise<BaseResponseAPI<PagedResult<ProductWithVariantsResponse>>> {
    const parsedResult = this.nlpEngineService.parseAndNormalize(searchText);
    const extractedObject = this.mapParsedToStructuredAnalysis(parsedResult, request);
    const structuredResult = await this.getProductsByStructuredQuery(extractedObject);

    if (!structuredResult.success || !structuredResult.data) {
      return {
        success: false,
        error: structuredResult.error || 'Failed to fetch products by parsed query',
        payload: this.createEmptyPagedProducts(request)
      };
    }

    return {
      success: true,
      payload: structuredResult.data
    };
  }

  async getAllProducts(
    request: PagedAndSortedRequest
  ): Promise<BaseResponseAPI<PagedResult<ProductResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const skip = (request.PageNumber - 1) * request.PageSize;
        const take = request.PageSize;

        const [products, totalCount] = await Promise.all([
          this.prisma.products.findMany({
            skip,
            take,
            include: productInclude
          }),
          this.prisma.products.count()
        ]);

        const result = new PagedResult<ProductResponse>({
          items: products.map(mapProduct),
          pageNumber: request.PageNumber,
          pageSize: request.PageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / request.PageSize)
        });
        return { success: true, payload: result };
      },
      'Failed to fetch products',
      true
    );
  }

  async getProductsUsingSemanticSearch(
    searchText: string,
    request: PagedAndSortedRequest
  ): Promise<BaseResponseAPI<PagedResult<ProductWithVariantsResponse>>> {
    return await funcHandlerAsync(
      async () => {
        if (!searchText?.trim()) {
          return { success: true, payload: this.createEmptyPagedProducts(request) };
        }

        this.logger.log('[SEARCH][QUERY_ONLY] getProductsUsingSemanticSearch -> parsed query path');
        return await this.runParsedQuerySearch(searchText, request);
      },
      'Failed to fetch products using semantic query path',
      true
    );
  }

  /**
   * Backward-compat endpoint: currently runs NLP parsed-query path only.
   */
  async getProductsUsingAiSearch(
    searchText: string,
    request: PagedAndSortedRequest
  ): Promise<BaseResponseAPI<PagedResult<ProductWithVariantsResponse>>> {
    return await funcHandlerAsync(
      async () => {
        if (!searchText?.trim()) {
          return { success: true, payload: this.createEmptyPagedProducts(request) };
        }

        this.logger.log('[SEARCH][NLP_ONLY] getProductsUsingAiSearch -> parsed query path');
        return await this.runParsedQuerySearch(searchText, request);
      },
      'Failed to fetch products using NLP query path',
      true
    );
  }

  /**
    * Search sản phẩm dùng parser (winkNLP) -> map sang structured analysis -> chạy `getProductsByStructuredQuery`.
    * Không dùng Elasticsearch path, phục vụ kiểm chứng parse -> query DB hiện tại.
   */
  async getProductsUsingParsedSearch(
    searchText: string,
    request: PagedAndSortedRequest
  ): Promise<BaseResponseAPI<any>> {
    return await funcHandlerAsync(
      async () => {
        const parsedResult = this.nlpEngineService.parseAndNormalize(searchText);
        const extractedObject = this.mapParsedToStructuredAnalysis(parsedResult, request);

        const structuredResult = await this.getProductsByStructuredQuery(extractedObject);
        const result = structuredResult.data;

        return {
          success: structuredResult.success,
          payload: {
            ...result,
            parsedResult,
            extractedObject,
            queryLogicUsed: extractedObject.logic ?? [],
          },
        };
      },
      'Failed to fetch products using parsed query path',
      true,
    );
  }

  private mapParsedToStructuredAnalysis(parsed: Record<string, any>, request: PagedAndSortedRequest): any {
    const byType = parsed?.byType && typeof parsed.byType === 'object' ? parsed.byType : {};
    const signals = parsed?.signals && typeof parsed.signals === 'object' ? parsed.signals : {};
    const entityDictionary = this.dictionaryBuilderService.getSnapshot()?.entityDictionary;
    const searchText = [parsed?.input, parsed?.normalizedInput].find((value): value is string => typeof value === 'string' && value.trim().length > 0) ?? '';

    const productNames = this.expandTermsForStructuredQuery(this.asStringArray(byType.product_name), entityDictionary);
    const genderValues = this.expandTermsForStructuredQuery(this.asStringArray(byType.gender), entityDictionary);
    const originValues = this.expandTermsForStructuredQuery(this.asStringArray(byType.origin), entityDictionary);
    const concentrationValues = this.expandTermsForStructuredQuery(this.asStringArray(byType.concentration), entityDictionary);
    const variantTypeValues = this.expandTermsForStructuredQuery(this.asStringArray(byType.variant_type), entityDictionary);

    const logicGroups: string[][] = [];
    const pushGroup = (values: unknown) => {
      const baseTerms = this.asStringArray(values);
      const group = this.expandTermsForStructuredQuery(baseTerms, entityDictionary);
      if (group.length > 0) {
        logicGroups.push(group);
      }
    };

    pushGroup(byType.brand);
    pushGroup(byType.category);
    pushGroup(byType.olfactory_family);
    pushGroup(byType.scent_note);
    const attributeValues = this.asStringArray(byType.attribute_value);
    const nonAgeAttributeValues = attributeValues.filter(value => !this.isAgeBucketValue(value));
    const ageAttributeValues = attributeValues.filter(value => this.isAgeBucketValue(value));
    pushGroup(nonAgeAttributeValues);

    const releaseYear = this.extractReleaseYear(searchText);
    const volumeValues = this.extractVolumeValues(searchText);
    const minLongevity = this.extractThreshold(searchText, /(\d+(?:\.\d+)?)\s*(?:h|gi[oờ]?)\b/i);
    const minSillage = this.extractThreshold(searchText, new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:/10|điểm|points?)\\b', 'i'));

    const priceRange = signals?.priceRange && typeof signals.priceRange === 'object' ? signals.priceRange : {};
    const ageRange = signals?.ageRange && typeof signals.ageRange === 'object' ? signals.ageRange : {};
    const budget = {
      min: typeof priceRange.minPriceVnd === 'number' ? priceRange.minPriceVnd : undefined,
      max: typeof priceRange.maxPriceVnd === 'number' ? priceRange.maxPriceVnd : undefined,
    };
    const minAge = typeof ageRange.minAge === 'number' ? ageRange.minAge : undefined;
    const maxAge = typeof ageRange.maxAge === 'number' ? ageRange.maxAge : undefined;

    return {
      logic: logicGroups,
      productNames,
      ageAttributeValues: this.expandTermsForStructuredQuery(ageAttributeValues, entityDictionary),
      genderValues,
      originValues,
      concentrationValues,
      variantTypeValues,
      volumeValues,
      releaseYear,
      minAge,
      maxAge,
      minLongevity,
      minSillage,
      budget,
      sorting: {
        field: 'Newest',
        isDescending: request.SortOrder !== 'asc',
      },
      pagination: {
        pageNumber: request.PageNumber || 1,
        pageSize: request.PageSize || 10,
      },
    };
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)));
  }

  private asNumberArray(value: unknown): number[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return Array.from(
      new Set(
        value
          .map(item => Number(item))
          .filter(item => Number.isFinite(item) && item > 0)
      )
    );
  }

  private asOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private extractReleaseYear(text: string): number | undefined {
    const match = text.match(/\b(19\d{2}|20\d{2})\b/);
    return match ? Number(match[1]) : undefined;
  }

  private extractVolumeValues(text: string): number[] {
    const matches = Array.from(text.matchAll(/\b(\d+(?:\.\d+)?)\s*ml\b/gi));
    return Array.from(new Set(matches.map(match => Number(match[1])).filter(value => Number.isFinite(value) && value > 0)));
  }

  private extractThreshold(text: string, pattern: RegExp): number | undefined {
    const match = text.match(pattern);
    if (!match?.[1]) {
      return undefined;
    }

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private isAgeBucketValue(value: string): boolean {
    const normalized = this.normalizeForLookup(value);
    if (!normalized) {
      return false;
    }

    return /(tuoi|thanh nien|nguoi lon|trung nien|thieu nien|teen)/i.test(normalized);
  }

  private inferAgeTermsFromRange(minAge?: number, maxAge?: number): string[] {
    if (minAge === undefined && maxAge === undefined) {
      return [];
    }

    const terms = new Set<string>();

    if (maxAge !== undefined && maxAge <= 25) {
      terms.add('thanh nien');
      terms.add('20-29');
      terms.add('20 29');
      terms.add('duoi 25');
      terms.add('dưới 25');
    }

    if (minAge !== undefined && minAge >= 25) {
      terms.add('thanh nien');
      terms.add('25-30');
      terms.add('25 30');
      terms.add('nguoi lon');
      terms.add('người lớn');
    }

    if (minAge !== undefined && minAge >= 30) {
      terms.add('nguoi lon');
      terms.add('người lớn');
      terms.add('30-45');
      terms.add('30 45');
    }

    if (minAge !== undefined && minAge >= 45) {
      terms.add('trung nien');
      terms.add('45+');
    }

    return Array.from(terms);
  }

  private expandTermsForStructuredQuery(terms: string[], entityDictionary?: EntityDictionary): string[] {
    const expanded = new Set<string>();

    for (const term of terms) {
      const normalizedTerm = term.trim();
      if (!normalizedTerm) continue;

      expanded.add(normalizedTerm);

      const unescaped = this.safeUnescapeUnicode(normalizedTerm);
      if (unescaped) {
        expanded.add(unescaped);
      }

      // Keep escaped representation when input arrives as unicode escapes.
      const escaped = this.safeEscapeUnicode(unescaped || normalizedTerm);
      if (escaped && escaped !== unescaped && escaped !== normalizedTerm) {
        expanded.add(escaped);
      }

      const normalizedKey = this.normalizeForLookup(unescaped || normalizedTerm);
      if (!entityDictionary || !normalizedKey) continue;

      for (const canonicalMap of Object.values(entityDictionary)) {
        const synonyms = canonicalMap[normalizedKey];
        if (!synonyms) continue;

        // Canonical no-diacritic remains as fallback search token.
        expanded.add(normalizedKey);

        // Synonyms preserve Vietnamese diacritics and punctuation from source DB.
        for (const syn of synonyms) {
          const trimmedSyn = syn?.trim();
          if (trimmedSyn) {
            expanded.add(trimmedSyn);
          }
        }
      }
    }

    return Array.from(expanded);
  }

  private normalizeForLookup(text: string): string {
    return this.normalizeTextNfc(text)
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeTextNfc(text: string): string {
    return text
      .normalize('NFC')
      .toLowerCase()
      .replace(/[\s\-]+/g, ' ')
      .trim();
  }

  private safeUnescapeUnicode(value: string): string {
    try {
      return unescapeUnicode(value);
    } catch {
      return value;
    }
  }

  private safeEscapeUnicode(value: string): string {
    try {
      return escapeUnicode(value, { filter: isNotAscii });
    } catch {
      return value;
    }
  }

  /**
   * Semantic search sản phẩm, trả về kèm toàn bộ variants.
   * Gọi external API để lấy danh sách ID đã rank → query Prisma enrich variants.
   */
  async getProductsUsingSemanticSearchWithVariants(
    searchText: string,
    request: PagedAndSortedRequest
  ): Promise<BaseResponse<PagedResult<ProductWithVariantsResponse>>> {
    // Reuse the semantic query path and return the same paged payload contract.
    const result = await this.getProductsUsingSemanticSearch(searchText, request);
    return {
      success: result.success,
      data: result.payload
    };
  }

  async syncAllProductsToIndex() {
    return await funcHandlerAsync(
      async () => {
        await this.searchService.syncAllProducts();
        return { success: true, message: 'Products sync triggered successfully' };
      },
      'Failed to sync products to index',
      true
    );
  }

  async resolveProductViewInfo(
    productId: string,
    variantId?: string
  ): Promise<{
    productName?: string;
    variantName?: string;
    brand?: string;
    category?: string;
    gender?: string;
    scentNotes?: string[];
    olfactoryFamilies?: string[];
    basePrice?: number;
  }> {
    const product = await this.prisma.products.findFirst({
      where: { Id: productId, IsDeleted: false },
      select: {
        Name: true,
        Gender: true,
        Brands: {
          select: {
            Name: true
          }
        },
        Categories: {
          select: {
            Name: true
          }
        },
        ProductNoteMaps: {
          select: {
            ScentNotes: {
              select: {
                Name: true
              }
            }
          }
        },
        ProductFamilyMaps: {
          select: {
            OlfactoryFamilies: {
              select: {
                Name: true
              }
            }
          }
        }
      }
    });

    const productContext = {
      productName: product?.Name,
      brand: product?.Brands?.Name,
      category: product?.Categories?.Name,
      gender: product?.Gender ?? undefined,
      scentNotes:
        product?.ProductNoteMaps?.map((item) => item.ScentNotes?.Name).filter(
          Boolean
        ) ?? [],
      olfactoryFamilies:
        product?.ProductFamilyMaps?.map(
          (item) => item.OlfactoryFamilies?.Name
        ).filter(Boolean) ?? []
    };

    if (!variantId) {
      return productContext;
    }

    const variant = await this.prisma.productVariants.findFirst({
      where: { Id: variantId, IsDeleted: false },
      select: {
        ProductId: true,
        Sku: true,
        Type: true,
        VolumeMl: true,
        BasePrice: true,
        Concentrations: {
          select: { Name: true }
        }
      }
    });

    if (!variant || variant.ProductId !== productId) {
      return productContext;
    }

    const variantParts = [
      variant.Type?.trim(),
      variant.VolumeMl ? `${variant.VolumeMl}ml` : undefined,
      variant.Concentrations?.Name?.trim()
    ].filter((part): part is string => Boolean(part));

    const variantName =
      variantParts.join(' ').trim() ||
      (variant.Sku ? `SKU ${variant.Sku}` : undefined);

    return {
      ...productContext,
      variantName,
      basePrice: Number(variant.BasePrice)
    };
  }

  /** Lấy chi tiết một sản phẩm kèm toàn bộ variants */
  async getProductWithVariants(
    @Query('id') id: string
  ): Promise<BaseResponse<ProductWithVariantsResponse>> {
    return await funcHandlerAsync(
      async () => {
        const product = await this.prisma.products.findFirst({
          where: { Id: id, IsDeleted: false },
          include: productWithVariantsInclude
        });

        if (!product) {
          throw new NotFoundException(`Không tìm thấy sản phẩm với id: ${id}`);
        }

        return { success: true, data: mapProductWithVariants(product) };
      },
      'Failed to fetch product with variants',
      true
    );
  }

  /** Lấy chi tiết một sản phẩm kèm toàn bộ variants */
  async getAllProductsWithVariants(
    @Query() request: PagedAndSortedRequest
  ): Promise<BaseResponse<PagedResult<ProductWithVariantsResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const skip = (request.PageNumber - 1) * request.PageSize;
        const take = request.PageSize;

        const [products, totalCount] = await Promise.all([
          this.prisma.products.findMany({
            where: { IsDeleted: false },
            include: productWithVariantsInclude,
            skip,
            take,
            orderBy: {
              CreatedAt: request.SortOrder === 'asc' ? 'asc' : 'desc'
            }
          }),
          this.prisma.products.count({
            where: { IsDeleted: false }
          })
        ]);

        if (!products) {
          throw new NotFoundException(`Không tìm thấy sản phẩm`);
        }

        return {
          success: true,
          data: new PagedResult<ProductWithVariantsResponse>({
            items: products.map(mapProductWithVariants),
            pageNumber: request.PageNumber,
            pageSize: request.PageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / request.PageSize)
          })
        };
      },
      'Failed to fetch product with variants',
      true
    );
  }

  async getNewestProductsWithVariants(
    @Query() request: PagedAndSortedRequest
  ): Promise<BaseResponse<PagedResult<ProductWithVariantsResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const skip = (request.PageNumber - 1) * request.PageSize;
        const take = request.PageSize;

        const [products, totalCount] = await Promise.all([
          this.prisma.products.findMany({
            where: { IsDeleted: false },
            include: productWithVariantsInclude,
            skip,
            take,
            orderBy: { CreatedAt: 'desc' }
          }),
          this.prisma.products.count({ where: { IsDeleted: false } })
        ]);

        return {
          success: true,
          data: new PagedResult<ProductWithVariantsResponse>({
            items: products.map(mapProductWithVariants),
            pageNumber: request.PageNumber,
            pageSize: request.PageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / request.PageSize)
          })
        };
      },
      'Failed to fetch newest products with variants',
      true
    );
  }

  async getBestSellingProducts(
    @Query() request: PagedAndSortedRequest
  ): Promise<BaseResponse<PagedResult<BestSellingProductResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const skip = (request.PageNumber - 1) * request.PageSize;
        const take = request.PageSize;

        const groupedByVariant = await this.prisma.orderDetails.groupBy({
          by: ['VariantId'],
          _sum: { Quantity: true }
        });

        if (groupedByVariant.length === 0) {
          return {
            success: true,
            data: new PagedResult<BestSellingProductResponse>({
              items: [],
              pageNumber: request.PageNumber,
              pageSize: request.PageSize,
              totalCount: 0,
              totalPages: 0
            })
          };
        }

        const variantIds = groupedByVariant.map((item) => item.VariantId);
        const variants = await this.prisma.productVariants.findMany({
          where: {
            Id: { in: variantIds },
            IsDeleted: false,
            Products: { IsDeleted: false }
          },
          select: {
            Id: true,
            ProductId: true
          }
        });

        const variantToProductMap = new Map(
          variants.map((item) => [item.Id, item.ProductId])
        );

        const productSoldMap = new Map<string, number>();
        for (const row of groupedByVariant) {
          const productId = variantToProductMap.get(row.VariantId);
          if (!productId) {
            continue;
          }

          const soldQty = row._sum.Quantity ?? 0;
          const current = productSoldMap.get(productId) ?? 0;
          productSoldMap.set(productId, current + soldQty);
        }

        const sortedProductSales = Array.from(productSoldMap.entries()).sort(
          (a, b) => b[1] - a[1]
        );

        const totalCount = sortedProductSales.length;
        const pagedProductSales = sortedProductSales.slice(skip, skip + take);
        const pagedProductIds = pagedProductSales.map(
          ([productId]) => productId
        );

        if (pagedProductIds.length === 0) {
          return {
            success: true,
            data: new PagedResult<BestSellingProductResponse>({
              items: [],
              pageNumber: request.PageNumber,
              pageSize: request.PageSize,
              totalCount,
              totalPages: Math.ceil(totalCount / request.PageSize)
            })
          };
        }

        const products = await this.prisma.products.findMany({
          where: { Id: { in: pagedProductIds }, IsDeleted: false },
          include: productWithVariantsInclude
        });

        const productMap = new Map(products.map((item) => [item.Id, item]));
        const items: BestSellingProductResponse[] = pagedProductIds
          .map((productId) => {
            const product = productMap.get(productId);
            const totalSoldQuantity = productSoldMap.get(productId) || 0;
            if (!product) {
              return null;
            }

            return {
              product: mapProductWithVariants(product),
              totalSoldQuantity
            };
          })
          .filter((item): item is BestSellingProductResponse => item !== null);

        return {
          success: true,
          data: new PagedResult<BestSellingProductResponse>({
            items,
            pageNumber: request.PageNumber,
            pageSize: request.PageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / request.PageSize)
          })
        };
      },
      'Failed to fetch best selling products',
      true
    );
  }

  async getLeastSellingProducts(
    @Query() request: PagedAndSortedRequest
  ): Promise<BaseResponse<PagedResult<BestSellingProductResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const skip = (request.PageNumber - 1) * request.PageSize;
        const take = request.PageSize;

        const groupedByVariant = await this.prisma.orderDetails.groupBy({
          by: ['VariantId'],
          _sum: { Quantity: true }
        });

        // For least selling, we also want to consider products that have NEVER been sold (Quantity = 0)
        const allProducts = await this.prisma.products.findMany({
          where: { IsDeleted: false },
          select: { Id: true }
        });

        const productSoldMap = new Map<string, number>(allProducts.map(p => [p.Id, 0]));

        if (groupedByVariant.length > 0) {
          const variantIds = groupedByVariant.map((item) => item.VariantId);
          const variants = await this.prisma.productVariants.findMany({
            where: { Id: { in: variantIds }, IsDeleted: false, Products: { IsDeleted: false } },
            select: { Id: true, ProductId: true }
          });

          const variantToProductMap = new Map(variants.map((item) => [item.Id, item.ProductId]));

          for (const row of groupedByVariant) {
            const productId = variantToProductMap.get(row.VariantId);
            if (!productId) continue;
            const soldQty = row._sum.Quantity ?? 0;
            const current = productSoldMap.get(productId) ?? 0;
            productSoldMap.set(productId, current + soldQty);
          }
        }

        const sortedProductSales = Array.from(productSoldMap.entries()).sort(
          (a, b) => a[1] - b[1] // Ascending order for least selling
        );

        const totalCount = sortedProductSales.length;
        const pagedProductSales = sortedProductSales.slice(skip, skip + take);
        const pagedProductIds = pagedProductSales.map(([productId]) => productId);

        if (pagedProductIds.length === 0) {
          return {
            success: true,
            data: new PagedResult<BestSellingProductResponse>({
              items: [],
              pageNumber: request.PageNumber,
              pageSize: request.PageSize,
              totalCount,
              totalPages: 1
            })
          };
        }

        const products = await this.prisma.products.findMany({
          where: { Id: { in: pagedProductIds }, IsDeleted: false },
          include: productWithVariantsInclude
        });

        const productMap = new Map(products.map((item) => [item.Id, item]));
        const items: BestSellingProductResponse[] = pagedProductIds
          .map((productId) => {
            const product = productMap.get(productId);
            const totalSoldQuantity = productSoldMap.get(productId) || 0;
            if (!product) return null;
            return {
              product: mapProductWithVariants(product),
              totalSoldQuantity
            };
          })
          .filter((item): item is BestSellingProductResponse => item !== null);

        return {
          success: true,
          data: new PagedResult<BestSellingProductResponse>({
            items,
            pageNumber: request.PageNumber,
            pageSize: request.PageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / request.PageSize)
          })
        };
      },
      'Failed to fetch least selling products',
      true
    );
  }

  async getProductsByStructuredQuery(
    analysis: any // Should be AnalysisObject but keeping any for simplicity in import
  ): Promise<BaseResponse<PagedResult<ProductWithVariantsResponse>>> {
    return await funcHandlerAsync(async () => {
      const { logic, sorting, budget, pagination, productNames } = analysis;
      const genderValues = this.asStringArray(analysis.genderValues ?? analysis.gender);
      const originValues = this.asStringArray(analysis.originValues ?? analysis.origin);
      const concentrationValues = this.asStringArray(analysis.concentrationValues ?? analysis.concentration);
      const variantTypeValues = this.asStringArray(analysis.variantTypeValues ?? analysis.variantType);
      const ageAttributeValues = this.asStringArray(analysis.ageAttributeValues);
      const volumeValues = this.asNumberArray(analysis.volumeValues ?? analysis.volume);
      const releaseYear = this.asOptionalNumber(analysis.releaseYear);
      const minAge = this.asOptionalNumber(analysis.minAge);
      const maxAge = this.asOptionalNumber(analysis.maxAge);
      const inferredAgeTerms = this.inferAgeTermsFromRange(minAge, maxAge);
      const ageTerms = Array.from(new Set([...ageAttributeValues, ...inferredAgeTerms]));
      const minLongevity = this.asOptionalNumber(analysis.minLongevity);
      const minSillage = this.asOptionalNumber(analysis.minSillage);
      const skip = ((pagination?.pageNumber || 1) - 1) * (pagination?.pageSize || 5);
      const take = pagination?.pageSize || 5;

      // Build Name-specific conditions
      const nameConditions: Prisma.ProductsWhereInput[] = (productNames || []).map((name: string) => ({
        Name: { contains: name }
      }));

      // Purity check: Filter out generic or price-related keywords
      const purifiedLogic = (logic || []).map((group: any) => {
        const andItems = Array.isArray(group) ? group : [group];
        const filtered = andItems.filter((item: string) => {
          const lower = item.toLowerCase();
          return !['nước hoa', 'perfume', 'dầu thơm', 'price', 'budget', 'gian hàng', 'giá'].includes(lower) &&
            !lower.includes('price<') && !lower.includes('price>');
        });
        return filtered.length > 0 ? filtered : null;
      }).filter(group => group !== null);

      // Build AND conditions (each group is a set of OR alternatives)
      const groupConditions: Prisma.ProductsWhereInput[] = purifiedLogic.map((group: any) => {
        const orItems = group;
        const orConditionsForGroup: Prisma.ProductsWhereInput[] = orItems.map((item: string) => ({
          OR: [
            { Name: { contains: item } },
            { Brands: { Name: { contains: item } } },
            { Categories: { Name: { contains: item } } },
            { Gender: { contains: item } },
            { Origin: { contains: item } },
            { ProductNoteMaps: { some: { ScentNotes: { Name: { contains: item } } } } },
            { ProductFamilyMaps: { some: { OlfactoryFamilies: { Name: { contains: item } } } } },
            { ProductAttributes: { some: { AttributeValues: { Value: { contains: item } } } } },
            { ProductVariants: { some: { Type: { contains: item } } } },
            { ProductVariants: { some: { Concentrations: { Name: { contains: item } } } } },
            { ProductVariants: { some: { ProductAttributes: { some: { AttributeValues: { Value: { contains: item } } } } } } },
            ...(this.extractReleaseYear(item) ? [{ ReleaseYear: this.extractReleaseYear(item)! }] : []),
            ...(this.extractVolumeValues(item).length > 0 ? [{ ProductVariants: { some: { VolumeMl: { in: this.extractVolumeValues(item) } } } }] : []),
            ...(this.extractThreshold(item, /(\d+(?:\.\d+)?)\s*(?:h|gi[oờ]?)\b/i) !== undefined
              ? [{ ProductVariants: { some: { Longevity: { gte: this.extractThreshold(item, /(\d+(?:\.\d+)?)\s*(?:h|gi[oờ]?)\b/i)! } } } }]
              : []),
            ...(this.extractThreshold(item, new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:/10|điểm|points?)\\b', 'i')) !== undefined
              ? [{ ProductVariants: { some: { Sillage: { gte: this.extractThreshold(item, new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:/10|điểm|points?)\\b', 'i'))! } } } }]
              : [])
          ]
        }));
        return { OR: orConditionsForGroup };
      });

      const andConditionsForWhere: Prisma.ProductsWhereInput[] = [];

      if (nameConditions.length > 0) {
        andConditionsForWhere.push({ OR: nameConditions });
      }

      if (groupConditions.length > 0) {
        andConditionsForWhere.push(...groupConditions);
      }

      if (ageTerms.length > 0) {
        andConditionsForWhere.push({
          ProductAttributes: {
            some: {
              OR: ageTerms.map(value => ({
                AttributeValues: {
                  Value: { contains: value }
                }
              }))
            }
          }
        });
      }

      if (genderValues.length > 0) {
        andConditionsForWhere.push({
          OR: genderValues.map(value => ({
            Gender: { contains: value }
          }))
        });
      }

      if (originValues.length > 0) {
        andConditionsForWhere.push({
          OR: originValues.map(value => ({
            Origin: { contains: value }
          }))
        });
      }

      if (releaseYear !== undefined) {
        andConditionsForWhere.push({ ReleaseYear: releaseYear });
      }

      if (volumeValues.length > 0) {
        andConditionsForWhere.push({
          ProductVariants: {
            some: {
              IsDeleted: false,
              VolumeMl: { in: volumeValues }
            }
          }
        });
      }

      if (concentrationValues.length > 0) {
        andConditionsForWhere.push({
          ProductVariants: {
            some: {
              IsDeleted: false,
              OR: concentrationValues.map(value => ({
                Concentrations: {
                  Name: { contains: value }
                }
              }))
            }
          }
        });
      }

      if (variantTypeValues.length > 0) {
        andConditionsForWhere.push({
          ProductVariants: {
            some: {
              IsDeleted: false,
              OR: variantTypeValues.map(value => ({
                Type: { contains: value }
              }))
            }
          }
        });
      }

      if (minLongevity !== undefined) {
        andConditionsForWhere.push({
          ProductVariants: {
            some: {
              IsDeleted: false,
              Longevity: { gte: minLongevity }
            }
          }
        });
      }

      if (minSillage !== undefined) {
        andConditionsForWhere.push({
          ProductVariants: {
            some: {
              IsDeleted: false,
              Sillage: { gte: minSillage }
            }
          }
        });
      }

      if (budget) {
        andConditionsForWhere.push({
          ProductVariants: {
            some: {
              IsDeleted: false,
              BasePrice: {
                gte: budget.min ? Number(budget.min) : undefined,
                lte: budget.max ? Number(budget.max) : undefined
              }
            }
          }
        });
      }

      const where: Prisma.ProductsWhereInput = {
        IsDeleted: false,
        ...(andConditionsForWhere.length > 0 ? { AND: andConditionsForWhere } : {})
      };

      // Sorting logic
      let orderBy: Prisma.ProductsOrderByWithRelationInput = { CreatedAt: 'desc' };
      const isPriceSorting = sorting && sorting.field === 'Price';

      if (sorting && !isPriceSorting) {
        const direction = sorting.isDescending ? 'desc' : 'asc';
        switch (sorting.field) {
          case 'Newest':
            orderBy = { CreatedAt: direction };
            break;
          case 'Name':
            orderBy = { Name: direction };
            break;
          case 'Volume':
          case 'Sales':
          default:
            orderBy = { CreatedAt: 'desc' };
        }
      }

      let products: ProductWithVariantsRelations[] = [];
      let totalCount = 0;

      if (!isPriceSorting) {
        // Fallback or Normal Sorting behavior
        [products, totalCount] = await Promise.all([
          this.prisma.products.findMany({
            where,
            include: productWithVariantsInclude,
            skip,
            take,
            orderBy
          }),
          this.prisma.products.count({ where })
        ]);
      } else {
        // ==========================================
        // Custom IN-MEMORY Price Sorting
        // ==========================================
        const matchedProducts = await this.prisma.products.findMany({
          where,
          select: { Id: true }
        });
        const matchedIds = matchedProducts.map(p => p.Id);
        totalCount = matchedIds.length;

        if (totalCount > 0) {
          const variantFilter: Prisma.ProductVariantsWhereInput = {
            ProductId: { in: matchedIds },
            IsDeleted: false,
            ...(budget && {
              BasePrice: {
                gte: budget.min ? Number(budget.min) : undefined,
                lte: budget.max ? Number(budget.max) : undefined
              }
            })
          };

          const variants = await this.prisma.productVariants.findMany({
            where: variantFilter,
            select: { ProductId: true, BasePrice: true }
          });

          // Compute max/min price for each Product among matching variants
          const priceMap = new Map<string, number>();
          variants.forEach(v => {
            const price = Number(v.BasePrice);
            const current = priceMap.get(v.ProductId);

            if (sorting.isDescending) {
              if (current === undefined || price > current) priceMap.set(v.ProductId, price);
            } else {
              if (current === undefined || price < current) priceMap.set(v.ProductId, price);
            }
          });

          // Sort product IDs based on the collected prices
          // Products that completely lost their variants (e.g., due to budget mismatch) will be sorted to the bottom/top depending on logic,
          // but they shouldn't exist because `matchedProducts` implies they passed the global `where` budget filter.
          matchedIds.sort((a, b) => {
            const priceA = priceMap.get(a) ?? (sorting.isDescending ? 0 : Infinity);
            const priceB = priceMap.get(b) ?? (sorting.isDescending ? 0 : Infinity);
            return sorting.isDescending ? priceB - priceA : priceA - priceB;
          });

          // Paginate in memory
          const finalProductIds = matchedIds.slice(skip, skip + take);

          // Fetch FULL details only for the paginated items
          const dbProducts = await this.prisma.products.findMany({
            where: { Id: { in: finalProductIds } },
            include: productWithVariantsInclude
          });

          // Restore original sorted order since DB doesn't retain IN () order
          products = finalProductIds
            .map(id => dbProducts.find(p => p.Id === id)!)
            .filter(Boolean);
        }
      }

      return {
        success: true,
        data: new PagedResult<ProductWithVariantsResponse>({
          items: products.map(mapProductWithVariants),
          pageNumber: (pagination?.pageNumber || 1),
          pageSize: take,
          totalCount,
          totalPages: Math.ceil(totalCount / take)
        })
      };
    }, 'Failed to fetch products by structured query');
  }

  async getProductsByIdsForOutput(ids: string[]): Promise<BaseResponse<ProductCardOutputItem[]>> {
    return await funcHandlerAsync(async () => {
      if (!ids || ids.length === 0) return { success: true, data: [] };

      const products = await this.prisma.products.findMany({
        where: {
          Id: { in: ids },
          IsDeleted: false
        },
        include: {
          Brands: true,
          Media: { where: { IsPrimary: true } },
          ProductVariants: {
            where: { IsDeleted: false }
          }
        }
      });

      // Maintain order of IDs passed by the AI
      const productMap = new Map(products.map(p => [p.Id, p]));

      const mappedProducts: ProductCardOutputItem[] = ids
        .map(id => productMap.get(id))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map(p => ({
          id: p.Id,
          name: p.Name,
          brandName: p.Brands.Name,
          primaryImage: p.Media[0]?.Url || null,
          variants: (p.ProductVariants || []).map(v => ({
            id: v.Id,
            sku: v.Sku,
            volumeMl: v.VolumeMl,
            basePrice: Number(v.BasePrice) // Convert Decimal to number
          }))
        }));

      return {
        success: true,
        data: mappedProducts
      };
    }, 'Failed to fetch products for AI output cards');
  }
}
