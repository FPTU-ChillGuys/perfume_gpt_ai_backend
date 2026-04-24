import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AddToCartRequest } from 'src/application/dtos/request/cart/add-to-cart.request';
import { UpdateCartItemRequest } from 'src/application/dtos/request/cart/update-cart-item.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { CartNatsRepository } from '../repositories/nats/cart-nats.repository';

@Injectable()
export class CartService {
    constructor(private readonly cartNatsRepo: CartNatsRepository) { }

    async getCart(userId: string): Promise<BaseResponse<any>> {
        return await funcHandlerAsync(async () => {
            const result = await this.cartNatsRepo.getCart(userId);
            const items = (result?.items || []).map((item: any) => ({
                id: item.cartItemId,
                variantId: item.variantId,
                productName: item.variantName,
                volumeMl: item.volumeMl,
                type: item.type,
                price: Number(item.variantPrice),
                quantity: item.quantity,
                imageUrl: item.imageUrl,
                isAvailable: item.isAvailable,
                subTotal: Number(item.subTotal),
            }));
            return { success: true, data: items };
        }, 'Failed to retrieve cart');
    }

    async addToCart(userId: string, request: AddToCartRequest): Promise<BaseResponse<string>> {
        return await funcHandlerAsync(async () => {
            const result = await this.cartNatsRepo.addToCart(userId, request.variantId, request.quantity);
            return { success: result.success, error: result.error, data: 'Thành công' };
        }, 'Failed to add item to cart');
    }

    async updateCartItem(userId: string, cartItemId: string, request: UpdateCartItemRequest): Promise<BaseResponse<string>> {
        return await funcHandlerAsync(async () => {
            const result = await this.cartNatsRepo.updateCartItem(userId, cartItemId, request.quantity);
            return { success: result.success, error: result.error, data: 'Thành công' };
        }, 'Failed to update cart item');
    }

    async removeFromCart(userId: string, cartItemId: string): Promise<BaseResponse<string>> {
        return await funcHandlerAsync(async () => {
            const result = await this.cartNatsRepo.removeFromCart(userId, cartItemId);
            return { success: result.success, error: result.error, data: 'Thành công' };
        }, 'Failed to remove item from cart');
    }

    async clearCart(userId: string): Promise<BaseResponse<string>> {
        return await funcHandlerAsync(async () => {
            const result = await this.cartNatsRepo.clearCart(userId);
            return { success: result.success, error: result.error, data: 'Thành công' };
        }, 'Failed to clear cart');
    }
}
