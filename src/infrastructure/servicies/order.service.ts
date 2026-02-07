import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { OrderRequest } from 'src/application/dtos/request/order.request';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { OrderResponse } from 'src/application/dtos/response/order.response';
import { funcHandlerAsync } from '../utils/error-handler';
import ApiUrl from '../api/api_url';
import { authorizationHeader } from '../utils/header';

@Injectable()
export class OrderService {
  constructor(private readonly httpService: HttpService) {}

  //Get order methods here
  async getAllOrders(
    request: OrderRequest,
    authHeader: string
  ): Promise<BaseResponseAPI<PagedResult<OrderResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const { data } = await firstValueFrom(
          this.httpService.get<BaseResponseAPI<PagedResult<OrderResponse>>>(
            ApiUrl().ORDER_URL(''),
            {
              params: {
                ...request
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

  async getOrderByUserId(
    userId: string,
    request: OrderRequest,
    authHeader: string
  ): Promise<BaseResponseAPI<PagedResult<OrderResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const { data } = await firstValueFrom(
          this.httpService.get<BaseResponseAPI<PagedResult<OrderResponse>>>(
            ApiUrl().ORDER_URL('user/' + userId),
            {
              params: {
                ...request
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
