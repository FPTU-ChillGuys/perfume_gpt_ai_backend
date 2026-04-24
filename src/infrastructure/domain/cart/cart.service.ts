import { Injectable } from '@nestjs/common';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { CartNatsRepository } from '../repositories/nats/cart-nats.repository';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class CartService {
  constructor(
    private readonly cartNatsRepo: CartNatsRepository,
    private readonly i18n: I18nService
  ) {}

  async getCart(userId: string): Promise<BaseResponseAPI<any>> {
    return await funcHandlerAsync(async () => {
      return await this.cartNatsRepo.getCart(userId);
    }, this.i18n.t('common.nats.errors.fetch_cart_failed'));
  }

  async addToCart(
    userId: string,
    variantId: string,
    quantity: number,
  ): Promise<BaseResponseAPI<any>> {
    return await funcHandlerAsync(async () => {
      return await this.cartNatsRepo.addToCart(userId, variantId, quantity);
    }, this.i18n.t('common.nats.errors.add_to_cart_failed'));
  }

  async clearCart(userId: string): Promise<BaseResponseAPI<any>> {
    return await funcHandlerAsync(async () => {
      return await this.cartNatsRepo.clearCart(userId);
    }, this.i18n.t('common.nats.errors.clear_cart_failed'));
  }

  async removeFromCart(
    userId: string,
    cartItemId: string,
  ): Promise<BaseResponseAPI<any>> {
    return await funcHandlerAsync(async () => {
      return await this.cartNatsRepo.removeFromCart(userId, cartItemId);
    }, this.i18n.t('common.nats.errors.remove_from_cart_failed'));
  }

  async updateCartItem(
    userId: string,
    cartItemId: string,
    quantity: number,
  ): Promise<BaseResponseAPI<any>> {
    return await funcHandlerAsync(async () => {
      return await this.cartNatsRepo.updateCartItem(userId, cartItemId, quantity);
    }, this.i18n.t('common.nats.errors.update_cart_failed'));
  }
}
