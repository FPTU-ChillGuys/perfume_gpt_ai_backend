import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NatsRpcService } from 'src/infrastructure/domain/common/nats/nats-rpc.service';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { OrderListItemResponse, OrderResponse } from 'src/application/dtos/response/order.response';

/** Kết quả trả về từ getOrdersByUserId: PagedResult<OrderListItemResponse> */
export type OrderPagedPayload = PagedResult<OrderListItemResponse>;

const ORDER_REQUEST_CHANNEL = 'order_data_request';
const DEFAULT_TIMEOUT = 10000;

@Injectable()
export class OrderNatsRepository {
  private readonly logger = new Logger(OrderNatsRepository.name);

  constructor(
    private readonly natsRpc: NatsRpcService,
    private readonly i18n: I18nService,
  ) {}

  async getOrdersByUserId(userId: string, params: unknown): Promise<OrderPagedPayload> {
    this.logger.log(`[NATS] ${this.i18n.t('order.get_orders')}: ${userId}`);
    return await this.natsRpc.sendRequest<OrderPagedPayload>(
      ORDER_REQUEST_CHANNEL,
      'getOrdersByUserId',
      { userId, ...(params as object) },
      DEFAULT_TIMEOUT,
    );
  }

  async getOrderDetails(userId: string, orderId: string): Promise<OrderResponse> {
    this.logger.log(`[NATS] ${this.i18n.t('order.get_details')}: User ${userId}, Order ${orderId}`);
    return await this.natsRpc.sendRequest<OrderResponse>(
      ORDER_REQUEST_CHANNEL,
      'getOrderDetails',
      { userId, orderId },
      DEFAULT_TIMEOUT,
    );
  }
}
