import { Injectable } from '@nestjs/common';
import { OrderRequest } from 'src/application/dtos/request/order.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import {
  OrderListItemResponse,
  OrderResponse
} from 'src/application/dtos/response/order.response';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { HttpService } from '@nestjs/axios';
import { OrderNatsRepository } from '../repositories/nats/order-nats.repository';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderNatsRepo: OrderNatsRepository,
    private readonly httpService: HttpService
  ) { }

  async getAllOrders(
    request: OrderRequest
  ): Promise<BaseResponseAPI<PagedResult<OrderListItemResponse>>> {
    return await funcHandlerAsync(async () => {
      const result = await this.orderNatsRepo.getOrdersByUserId('', request);
      return { success: true, payload: result };
    }, 'Failed to fetch all orders');
  }

  async getOrderById(orderId: string): Promise<BaseResponseAPI<OrderResponse>> {
    return await funcHandlerAsync(async () => {
      const result = await this.orderNatsRepo.getOrderDetails('', orderId);
      return { success: true, payload: result };
    }, 'Failed to fetch order details');
  }

  async getOrdersByUserId(
    userId: string,
    request: OrderRequest
  ): Promise<BaseResponseAPI<PagedResult<OrderListItemResponse>>> {
    return await funcHandlerAsync(async () => {
      const result = await this.orderNatsRepo.getOrdersByUserId(userId, request);
      return { success: true, payload: result };
    }, 'Failed to fetch orders by user id');
  }

  async getOrderDetailsWithOrdersByUserId(
    userId: string
  ): Promise<BaseResponse<OrderResponse[]>> {
    return await funcHandlerAsync(async () => {
      const result = await this.orderNatsRepo.getOrdersByUserId(userId, { pageSize: 100 });
      return { success: true, data: result.items as any[] };
    }, 'Failed to fetch order details with orders by user id', true);
  }

  async getOrderReportFromGetOrderDetailsWithOrdersByUserId(
    userId: string
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(async () => {
      const result = await this.orderNatsRepo.getOrdersByUserId(userId, { pageSize: 100 });
      if (!result || result.items.length === 0) {
        return { success: false, error: 'No orders found for the user' };
      }
      const report = result.items
        .map((o: any) => {
          return `Order ID: ${o.id}\nStatus: ${o.status}\nTotal Amount: ${o.totalAmount}\nCreated At: ${o.createdAt}\n`;
        })
        .join('\n----------------\n');
      return { success: true, data: report };
    }, 'Failed to create order report');
  }
}
