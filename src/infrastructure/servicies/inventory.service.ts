import { HttpService } from '@nestjs/axios';
import { InventoryStockRequest } from 'src/application/dtos/request/inventory-stock.request';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { InventoryStockResponse } from 'src/application/dtos/response/inventory-stock.response';
import { funcHandlerAsync } from '../utils/error-handler';
import ApiUrl from '../api/api_url';
import { firstValueFrom } from 'rxjs';
import { extractTokenFromHeader } from '../utils/extract-token';
import { authorizationHeader } from '../utils/header';
import { Injectable } from '@nestjs/common';

@Injectable()
export class InventoryService {
  constructor(private readonly httpService: HttpService) {}

  //Get inventory methods here
  async getInventoryStock(
    request: InventoryStockRequest,
    authHeader: string
  ): Promise<BaseResponseAPI<PagedResult<InventoryStockResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const { data } = await firstValueFrom(
          this.httpService.get<BaseResponseAPI<PagedResult<InventoryStockResponse>>>(
            ApiUrl().INVENTORY_URL('stock'),
            {
              params: {
                variantId: request.VariantId,
                searchTerm: request.SearchTerm,
                isLowStock: request.IsLowStock,
                pageNumber: request.PageNumber ?? 1,
                pageSize: request.PageSize ?? 10,
                sortBy: request.SortBy ?? '',
                sortOrder: request.SortOrder ?? 'asc',
                isDescending: request.IsDescending ?? false
              },
              headers: {
                Authorization: authorizationHeader(authHeader)
              }
            }
          )
        );
        return data;
      },
      'Failed to fetch inventory stock',
      true
    );
  }
}
