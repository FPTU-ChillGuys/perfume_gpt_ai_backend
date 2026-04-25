import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NatsRpcService } from 'src/infrastructure/domain/common/nats/nats-rpc.service';
import {
  NatsCartResponse,
  NatsCartMutationResponse
} from 'src/application/dtos/response/nats/nats-cart.response';

const CART_REQUEST_CHANNEL = 'cart_data_request';
const DEFAULT_TIMEOUT = 10000;

@Injectable()
export class CartNatsRepository {
  private readonly logger = new Logger(CartNatsRepository.name);

  constructor(
    private readonly natsRpc: NatsRpcService,
    private readonly i18n: I18nService,
  ) {}

  async getCart(userId: string): Promise<NatsCartResponse> {
    this.logger.log(`[NATS] ${this.i18n.t('cart.get_cart')}: ${userId}`);
    return await this.natsRpc.sendRequest<NatsCartResponse>(
      CART_REQUEST_CHANNEL,
      'getCart',
      { userId },
      DEFAULT_TIMEOUT,
    );
  }

  async addToCart(userId: string, variantId: string, quantity: number): Promise<NatsCartMutationResponse> {
    this.logger.log(`[NATS] ${this.i18n.t('cart.add_item')}: User ${userId}, Variant ${variantId}, Qty ${quantity}`);
    return await this.natsRpc.sendRequest<NatsCartMutationResponse>(
      CART_REQUEST_CHANNEL,
      'addToCart',
      { userId, variantId, quantity },
      DEFAULT_TIMEOUT,
    );
  }

  async clearCart(userId: string, force = false): Promise<NatsCartMutationResponse> {
    this.logger.log(`[NATS] ${this.i18n.t('cart.clear_cart')}: ${userId}, force: ${force}`);
    return await this.natsRpc.sendRequest<NatsCartMutationResponse>(
      CART_REQUEST_CHANNEL,
      'clearCart',
      { userId, force },
      DEFAULT_TIMEOUT,
    );
  }

  async removeFromCart(userId: string, cartItemId: string): Promise<NatsCartMutationResponse> {
    this.logger.log(`[NATS] ${this.i18n.t('cart.remove_item')}: User ${userId}, Item ${cartItemId}`);
    return await this.natsRpc.sendRequest<NatsCartMutationResponse>(
      CART_REQUEST_CHANNEL,
      'removeFromCart',
      { userId, cartItemId },
      DEFAULT_TIMEOUT,
    );
  }

  async updateCartItem(userId: string, cartItemId: string, quantity: number): Promise<NatsCartMutationResponse> {
    this.logger.log(`[NATS] ${this.i18n.t('cart.update_item')}: User ${userId}, Item ${cartItemId}, Qty ${quantity}`);
    return await this.natsRpc.sendRequest<NatsCartMutationResponse>(
      CART_REQUEST_CHANNEL,
      'updateCartItem',
      { userId, cartItemId, quantity },
      DEFAULT_TIMEOUT,
    );
  }
}
