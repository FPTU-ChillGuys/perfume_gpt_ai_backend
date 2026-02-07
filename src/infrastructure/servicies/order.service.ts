import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { OrderRequest } from 'src/application/dtos/request/order.request';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import {
  OrderListItemResponse,
  OrderResponse
} from 'src/application/dtos/response/order.response';
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
  ): Promise<BaseResponseAPI<PagedResult<OrderListItemResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const { data } = await firstValueFrom(
          this.httpService.get<
            BaseResponseAPI<PagedResult<OrderListItemResponse>>
          >(ApiUrl().ORDER_URL(''), {
            params: {
              ...request
            },
            headers: {
              Authorization: authorizationHeader(authHeader)
            }
          })
        );
        return data;
      },
      'Failed to fetch inventory stock',
      true
    );
  }

  async getOrderById(
    orderId: string,
    authHeader: string
  ): Promise<BaseResponseAPI<OrderResponse>> {
    return await funcHandlerAsync(
      async () => {
        const { data } = await firstValueFrom(
          this.httpService.get<BaseResponseAPI<OrderResponse>>(
            ApiUrl().ORDER_URL(''),
            {
              params: {
                orderId: orderId
              },
              headers: {
                Authorization: authorizationHeader(authHeader)
              }
            }
          )
        );
        return data;
      },
      'Failed to fetch order details',
      true
    );
  }

  async getOrdersByUserId(
    userId: string,
    request: OrderRequest,
    authHeader: string
  ): Promise<BaseResponseAPI<PagedResult<OrderListItemResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const { data } = await firstValueFrom(
          this.httpService.get<
            BaseResponseAPI<PagedResult<OrderListItemResponse>>
          >(ApiUrl().ORDER_URL('user/' + userId), {
            params: {
              ...request
            },
            headers: {
              Authorization: authorizationHeader(authHeader)
            }
          })
        );
        return data;
      },
      'Failed to fetch orders by user id',
      true
    );
  }

  async getOrderDetailsWithOrdersByUserId(
    userId: string,
    orderIds: string[],
    authHeader: string
  ): Promise<BaseResponseAPI<PagedResult<OrderListItemResponse>>> {
    return await funcHandlerAsync(
      async () => {
        const orders = await this.getOrdersByUserId(
          userId,
          new OrderRequest(),
          authHeader
        );
        const orderIds = orders.payload
          ? orders.payload.items.map((order) => order.id)
          : [];

        let orderDetailsList: OrderResponse[] = [];
        for (const orderId of orderIds) {
          const orderDetails = await this.getOrderById(orderId, authHeader);
          if (orderDetails.payload) {
            orderDetailsList.push(orderDetails.payload);
          }
        }
        return { success: true, data: orderDetailsList };
      },
      'Failed to fetch order details with orders by user id',
      true
    );
  }
}
