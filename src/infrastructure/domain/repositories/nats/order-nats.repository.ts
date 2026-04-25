import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NatsRpcService } from 'src/infrastructure/domain/common/nats/nats-rpc.service';
import { OrderResponse } from 'src/application/dtos/response/order.response';
import { NatsOrderPagedResponse } from 'src/application/dtos/response/nats/nats-order.response';

const ORDER_REQUEST_CHANNEL = 'order_data_request';
const DEFAULT_TIMEOUT = 10000;

@Injectable()
export class OrderNatsRepository {
  private readonly logger = new Logger(OrderNatsRepository.name);

  constructor(
    private readonly natsRpc: NatsRpcService,
    private readonly i18n: I18nService,
  ) {}

  async getOrdersByUserId(userId: string, params: unknown): Promise<NatsOrderPagedResponse> {
    this.logger.log(`[NATS] ${this.i18n.t('order.get_orders')}: ${userId}`);
    return await this.natsRpc.sendRequest<NatsOrderPagedResponse>(
      ORDER_REQUEST_CHANNEL,
      'getOrdersByUserId',
      { userId, ...(params as Record<string, unknown>) },
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
