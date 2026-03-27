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
import { funcHandlerAsync } from '../utils/error-handler';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { Prisma } from 'generated/prisma/client';
import ApiUrl from '../api/api_url';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { SearchService } from './search.service';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';

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
    private readonly httpService: HttpService,
    private readonly searchService: SearchService,
  ) { }

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
        const { items, totalCount } = await this.searchService.searchProducts(searchText, request);

        // Enrich the items with full variant info from Prisma
        const productIds = items.map((p: any) => p.id);
        const productsFromDb = await this.prisma.products.findMany({
          where: { Id: { in: productIds }, IsDeleted: false },
          include: productWithVariantsInclude
        });

        // Maintain the order from Elasticsearch
        const productMap = new Map(productsFromDb.map(p => [p.Id, p]));
        const enrichedItems = productIds
          .map(id => productMap.get(id))
          .filter(p => !!p)
          .map(p => mapProductWithVariants(p as ProductWithVariantsRelations));

        const result = new PagedResult<ProductWithVariantsResponse>({
          items: enrichedItems,
          pageNumber: request.PageNumber,
          pageSize: request.PageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / request.PageSize)
        });
        return { success: true, payload: result };
      },
      'Failed to fetch products using heuristic semantic search',
      true
    );
  }

  /**
   * Search sản phẩm sử dụng AI để trích xuất intent (brand, price, gender, notes, etc.)
   */
  async getProductsUsingAiSearch(
    searchText: string,
    request: PagedAndSortedRequest
  ): Promise<BaseResponseAPI<PagedResult<ProductWithVariantsResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const { items, totalCount } = await this.searchService.searchWithAi(searchText, request);

        // Enrich the items with full variant info from Prisma
        const productIds = items.map((p: any) => p.id);
        const productsFromDb = await this.prisma.products.findMany({
          where: { Id: { in: productIds }, IsDeleted: false },
          include: productWithVariantsInclude
        });

        // Maintain the order from Elasticsearch
        const productMap = new Map(productsFromDb.map(p => [p.Id, p]));
        const enrichedItems = productIds
          .map(id => productMap.get(id))
          .filter(p => !!p)
          .map(p => mapProductWithVariants(p as ProductWithVariantsRelations));

        const result = new PagedResult<ProductWithVariantsResponse>({
          items: enrichedItems,
          pageNumber: request.PageNumber,
          pageSize: request.PageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / request.PageSize)
        });
        return { success: true, payload: result };
      },
      'Failed to fetch products using semantic search v2',
      true
    );
  }

  /**
   * Semantic search sản phẩm, trả về kèm toàn bộ variants.
   * Gọi external API để lấy danh sách ID đã rank → query Prisma enrich variants.
   */
  async getProductsUsingSemanticSearchWithVariants(
    searchText: string,
    request: PagedAndSortedRequest
  ): Promise<BaseResponse<PagedResult<ProductWithVariantsResponse>>> {
    // Both methods now essentially do the same thing with the internal SearchService
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
  ): Promise<{ productName?: string; variantName?: string }> {
    const product = await this.prisma.products.findFirst({
      where: { Id: productId, IsDeleted: false },
      select: { Name: true }
    });

    if (!variantId) {
      return { productName: product?.Name };
    }

    const variant = await this.prisma.productVariants.findFirst({
      where: { Id: variantId, IsDeleted: false },
      select: {
        ProductId: true,
        Sku: true,
        Type: true,
        VolumeMl: true,
        Concentrations: {
          select: { Name: true }
        }
      }
    });

    if (!variant || variant.ProductId !== productId) {
      return { productName: product?.Name };
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
      productName: product?.Name,
      variantName
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
        const items: BestSellingProductResponse[] = pagedProductSales
          .map(([productId, totalSoldQuantity]) => {
            const product = productMap.get(productId);
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
}
