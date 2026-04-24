import { Injectable } from '@nestjs/common';
import { OrderRequest } from 'src/application/dtos/request/order.request';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import {
  OrderListItemResponse,
  OrderResponse,
} from 'src/application/dtos/response/order.response';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { HttpService } from '@nestjs/axios';
import { OrderNatsRepository } from '../repositories/nats/order-nats.repository';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderNatsRepo: OrderNatsRepository,
    private readonly httpService: HttpService,
    private readonly i18n: I18nService
  ) { }

  async getAllOrders(
    request: OrderRequest
  ): Promise<BaseResponseAPI<PagedResult<OrderListItemResponse>>> {
    return await funcHandlerAsync(async () => {
      const result = await this.orderNatsRepo.getOrdersByUserId('', request);
      return result;
    }, this.i18n.t('common.nats.errors.fetch_all_orders_failed'));
  }

  async getOrderById(orderId: string): Promise<BaseResponseAPI<OrderResponse>> {
    return await funcHandlerAsync(async () => {
      const result = await this.orderNatsRepo.getOrderDetails('', orderId);
      return result;
    }, this.i18n.t('common.nats.errors.fetch_order_details_failed'));
  }

  async getOrdersByUserId(
    userId: string,
    request: OrderRequest
  ): Promise<BaseResponseAPI<PagedResult<OrderListItemResponse>>> {
    return await funcHandlerAsync(async () => {
      const result = await this.orderNatsRepo.getOrdersByUserId(userId, request);
      return result;
    }, this.i18n.t('common.nats.errors.fetch_orders_failed'));
  }

  async getOrderDetailsWithOrdersByUserId(
    userId: string
  ): Promise<BaseResponse<OrderResponse[]>> {
    return await funcHandlerAsync(async () => {
      const result = await this.orderNatsRepo.getOrdersByUserId(userId, { pageSize: 100 });
      return result;
    }, this.i18n.t('common.nats.errors.fetch_order_details_failed'), true);
  }

  async getLatestOrderDetailsWithOrdersByUserId(
    userId: string
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(async () => {
      const result = await this.orderNatsRepo.getOrdersByUserId(userId, { pageSize: 100 });
      if (!result.success || !result.payload || result.payload.items.length === 0) {
        return { success: false, error: this.i18n.t('common.nats.errors.order_not_found') };
      }
      return { success: true, payload: JSON.stringify(result.payload.items[0]) };
    }, this.i18n.t('common.nats.errors.fetch_order_details_failed'), true);
  }
}
