import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import {
  ProductAttributeResponse,
  ProductResponse
} from 'src/application/dtos/response/product.response';
import { funcHandlerAsync } from '../utils/error-handler';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { Prisma } from 'generated/prisma/client';
import ApiUrl from '../api/api_url';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

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
    attributes: p.ProductAttributes.map(
      (attr): ProductAttributeResponse => ({
        id: attr.Id,
        attributeId: attr.AttributeId,
        valueId: attr.ValueId,
        attribute: attr.Attributes.Name,
        description: attr.Attributes.Description,
        value: attr.AttributeValues.Value
      })
    )
  };
}

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService
  ) {}

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
  ): Promise<BaseResponseAPI<PagedResult<ProductResponse>>> {
    return await funcHandlerAsync(
      async () => {
        console.log(ApiUrl().PRODUCT_URL('search/semantic'));
        const { data } = await firstValueFrom(
          this.httpService.get<BaseResponseAPI<PagedResult<ProductResponse>>>(
            ApiUrl().PRODUCT_URL('search/semantic'),
            {
              params: {
                searchText: searchText,
                pageNumber: request.PageNumber ?? 1,
                pageSize: request.PageSize ?? 10,
                sortBy: request.SortBy ?? '',
                sortOrder: request.SortOrder ?? 'asc',
                isDescending: request.IsDescending ?? false
              }
            }
          )
        );
        return data;
      },
      'Failed to fetch products',
      true
    );
  }
}
