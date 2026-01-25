import { HttpService } from '@nestjs/axios';
import ApiUrl from '../api/api_url';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { ProductListResponse } from 'src/application/dtos/response/product.response';
import { firstValueFrom } from 'rxjs';
import { funcHandlerAsync } from '../utils/error-handler';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProductService {
  constructor(private readonly httpService: HttpService) {}

  async getAllProducts(
    request: PagedAndSortedRequest
  ): Promise<BaseResponseAPI<ProductListResponse>> {
    return await funcHandlerAsync(
      async () => {
        console.log(ApiUrl().PRODUCT_URL(''));
        const { data } = await firstValueFrom(
          this.httpService.get<BaseResponseAPI<ProductListResponse>>(
            ApiUrl().PRODUCT_URL(''),
            {
              params: {
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
