import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NatsRpcService } from 'src/infrastructure/domain/common/nats/nats-rpc.service';

/** Ánh xạ từ .NET GetCartItemResponse */
export interface CartItemResponse {
  cartItemId: string;
  variantId: string;
  variantName: string;
  imageUrl: string;
  volumeMl: number;
  type: string;
  variantPrice: number;
  quantity: number;
  isAvailable: boolean;
  subTotal: number;
  promotionalQuantity: number;
  regularQuantity: number;
  discount: number;
  finalTotal: number;
}

/** Ánh xạ từ .NET GetCartItemsResponse */
export interface CartItemsPayload {
  items: CartItemResponse[];
}

/** Kết quả từ mutation actions (add/update/remove) - .NET trả BaseResponse (không có payload field rõ ràng) */
export interface CartMutationResult {
  success: boolean;
  error?: string | null;
}

const CART_REQUEST_CHANNEL = 'cart_data_request';
const DEFAULT_TIMEOUT = 10000;

@Injectable()
export class CartNatsRepository {
  private readonly logger = new Logger(CartNatsRepository.name);

  constructor(
    private readonly natsRpc: NatsRpcService,
    private readonly i18n: I18nService,
  ) {}

  async getCart(userId: string): Promise<CartItemsPayload> {
    this.logger.log(`[NATS] ${this.i18n.t('cart.get_cart')}: ${userId}`);
    return await this.natsRpc.sendRequest<CartItemsPayload>(
      CART_REQUEST_CHANNEL,
      'getCart',
      { userId },
      DEFAULT_TIMEOUT,
    );
  }

  async addToCart(userId: string, variantId: string, quantity: number): Promise<CartMutationResult> {
    this.logger.log(`[NATS] ${this.i18n.t('cart.add_item')}: User ${userId}, Variant ${variantId}, Qty ${quantity}`);
    return await this.natsRpc.sendRequest<CartMutationResult>(
      CART_REQUEST_CHANNEL,
      'addToCart',
      { userId, variantId, quantity },
      DEFAULT_TIMEOUT,
    );
  }

  async clearCart(userId: string): Promise<CartMutationResult> {
    this.logger.log(`[NATS] ${this.i18n.t('cart.clear_cart')}: ${userId}`);
    return await this.natsRpc.sendRequest<CartMutationResult>(
      CART_REQUEST_CHANNEL,
      'clearCart',
      { userId },
      DEFAULT_TIMEOUT,
    );
  }

  async removeFromCart(userId: string, cartItemId: string): Promise<CartMutationResult> {
    this.logger.log(`[NATS] ${this.i18n.t('cart.remove_item')}: User ${userId}, Item ${cartItemId}`);
    return await this.natsRpc.sendRequest<CartMutationResult>(
      CART_REQUEST_CHANNEL,
      'removeFromCart',
      { userId, cartItemId },
      DEFAULT_TIMEOUT,
    );
  }

  async updateCartItem(userId: string, cartItemId: string, quantity: number): Promise<CartMutationResult> {
    this.logger.log(`[NATS] ${this.i18n.t('cart.update_item')}: User ${userId}, Item ${cartItemId}, Qty ${quantity}`);
    return await this.natsRpc.sendRequest<CartMutationResult>(
      CART_REQUEST_CHANNEL,
      'updateCartItem',
      { userId, cartItemId, quantity },
      DEFAULT_TIMEOUT,
    );
  }
}
