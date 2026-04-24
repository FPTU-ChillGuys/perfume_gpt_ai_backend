import { Injectable, Logger } from '@nestjs/common';
import { NatsRpcService } from 'src/infrastructure/domain/common/nats/nats-rpc.service';
import { I18nService } from 'nestjs-i18n';

const CART_REQUEST_CHANNEL = 'cart_data_request';
const DEFAULT_TIMEOUT = 10000;

@Injectable()
export class CartNatsRepository {
  private readonly logger = new Logger(CartNatsRepository.name);

  constructor(
    private readonly natsRpc: NatsRpcService,
    private readonly i18n: I18nService
  ) {}

  async getCart(userId: string) {
    this.logger.log(this.i18n.t('common.nats.repository.fetching_cart', { args: { userId } }));
    return await this.natsRpc.sendRequest<any>(
      CART_REQUEST_CHANNEL,
      'getCart',
      { userId },
      DEFAULT_TIMEOUT
    );
  }

  async addToCart(userId: string, variantId: string, quantity: number) {
    this.logger.log(this.i18n.t('common.nats.repository.adding_to_cart', { args: { userId, variantId, quantity } }));
    return await this.natsRpc.sendRequest<any>(
      CART_REQUEST_CHANNEL,
      'addToCart',
      { userId, variantId, quantity },
      DEFAULT_TIMEOUT
    );
  }

  async clearCart(userId: string) {
    this.logger.log(this.i18n.t('common.nats.repository.clearing_cart', { args: { userId } }));
    return await this.natsRpc.sendRequest<any>(
      CART_REQUEST_CHANNEL,
      'clearCart',
      { userId },
      DEFAULT_TIMEOUT
    );
  }

  async removeFromCart(userId: string, cartItemId: string) {
    this.logger.log(this.i18n.t('common.nats.repository.removing_from_cart', { args: { userId, cartItemId } }));
    return await this.natsRpc.sendRequest<any>(
      CART_REQUEST_CHANNEL,
      'removeFromCart',
      { userId, cartItemId },
      DEFAULT_TIMEOUT
    );
  }

  async updateCartItem(userId: string, cartItemId: string, quantity: number) {
    this.logger.log(this.i18n.t('common.nats.repository.updating_cart', { args: { userId, cartItemId, quantity } }));
    return await this.natsRpc.sendRequest<any>(
      CART_REQUEST_CHANNEL,
      'updateCartItem',
      { userId, cartItemId, quantity },
      DEFAULT_TIMEOUT
    );
  }
}
