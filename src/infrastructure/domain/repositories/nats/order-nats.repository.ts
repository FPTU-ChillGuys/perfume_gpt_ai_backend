import { Injectable, Logger } from '@nestjs/common';
import { NatsRpcService } from 'src/infrastructure/domain/common/nats/nats-rpc.service';
import { I18nService } from 'nestjs-i18n';

const ORDER_REQUEST_CHANNEL = 'order_data_request';
const DEFAULT_TIMEOUT = 10000;

@Injectable()
export class OrderNatsRepository {
  private readonly logger = new Logger(OrderNatsRepository.name);

  constructor(
    private readonly natsRpc: NatsRpcService,
    private readonly i18n: I18nService
  ) {}

  async getOrdersByUserId(userId: string, params: any) {
    this.logger.log(this.i18n.t('common.nats.repository.fetching_orders', { args: { userId } }));
    return await this.natsRpc.sendRequest<any>(
      ORDER_REQUEST_CHANNEL,
      'getOrdersByUserId',
      { userId, ...params },
      DEFAULT_TIMEOUT
    );
  }

  async getOrderDetails(userId: string, orderId: string) {
    this.logger.log(this.i18n.t('common.nats.repository.fetching_order_details', { args: { userId, orderId } }));
    return await this.natsRpc.sendRequest<any>(
      ORDER_REQUEST_CHANNEL,
      'getOrderDetails',
      { userId, orderId },
      DEFAULT_TIMEOUT
    );
  }
}
