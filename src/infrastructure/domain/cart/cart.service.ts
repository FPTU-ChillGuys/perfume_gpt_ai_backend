import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddToCartRequest } from 'src/application/dtos/request/cart/add-to-cart.request';
import { UpdateCartItemRequest } from 'src/application/dtos/request/cart/update-cart-item.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';
import { NotFoundWithDetailsException, BadRequestWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CartService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly err: I18nErrorHandler
    ) { }

    async getCart(userId: string): Promise<BaseResponse<any>> {
        return this.err.wrap(async () => {
            const cartItems = await this.prisma.cartItems.findMany({
                where: { UserId: userId },
                include: {
                    ProductVariants: {
                        include: {
                            Products: true,
                            Concentrations: true,
                            Stocks: true,
                            Media: { where: { IsPrimary: true } },
                        },
                    },
                },
            });

            const items = cartItems.map((item) => ({
                id: item.Id,
                variantId: item.VariantId,
                productId: item.ProductVariants.ProductId,
                productName: item.ProductVariants.Products.Name,
                sku: item.ProductVariants.Sku,
                volumeMl: item.ProductVariants.VolumeMl,
                concentration: item.ProductVariants.Concentrations?.Name,
                price: Number(item.ProductVariants.BasePrice),
                quantity: item.Quantity,
                imageUrl: item.ProductVariants.Media[0]?.Url || null,
                stockQuantity: item.ProductVariants.Stocks?.TotalQuantity || 0,
                subTotal: Number(item.ProductVariants.BasePrice) * item.Quantity,
            }));

            const totalAmount = items.reduce((sum, item) => sum + item.subTotal, 0);

            return {
                success: true,
                data: {
                    items,
                    totalAmount,
                },
            };
        }, 'errors.cart.get');
    }

    async addToCart(userId: string, request: AddToCartRequest): Promise<BaseResponse<string>> {
        return this.err.wrap(async () => {
            const variant = await this.prisma.productVariants.findFirst({
                where: { Id: request.variantId, IsDeleted: false },
                include: { Stocks: true },
            });

            if (!variant) {
                this.err.throw('errors.cart.not_found', NotFoundWithDetailsException);
            }

            if (variant.Status !== 'Active') {
                this.err.throw('errors.cart.variant_unavailable', BadRequestWithDetailsException);
            }

            const existingItem = await this.prisma.cartItems.findFirst({
                where: { UserId: userId, VariantId: request.variantId },
            });

            const totalQuantity = existingItem ? existingItem.Quantity + request.quantity : request.quantity;

            if (!variant.Stocks || variant.Stocks.TotalQuantity < totalQuantity) {
                this.err.throw('errors.cart.insufficient_stock', BadRequestWithDetailsException);
            }

            if (existingItem) {
                await this.prisma.cartItems.update({
                    where: { Id: existingItem.Id },
                    data: { Quantity: totalQuantity },
                });
                return { success: true, data: existingItem.Id };
            }

            const newItem = await this.prisma.cartItems.create({
                data: {
                    Id: uuidv4(),
                    UserId: userId,
                    VariantId: request.variantId,
                    Quantity: request.quantity,
                },
            });

            return { success: true, data: newItem.Id };
        }, 'errors.cart.add_item');
    }

    async updateCartItem(userId: string, cartItemId: string, request: UpdateCartItemRequest): Promise<BaseResponse<string>> {
        return this.err.wrap(async () => {
            const cartItem = await this.prisma.cartItems.findFirst({
                where: { Id: cartItemId, UserId: userId },
                include: { ProductVariants: { include: { Stocks: true } } },
            });

            if (!cartItem) {
                this.err.throw('errors.cart.not_found', NotFoundWithDetailsException);
            }

            if (request.quantity <= 0) {
                await this.prisma.cartItems.delete({ where: { Id: cartItemId } });
                return { success: true, data: cartItemId };
            }

            if (!cartItem.ProductVariants.Stocks || cartItem.ProductVariants.Stocks.TotalQuantity < request.quantity) {
                this.err.throw('errors.cart.insufficient_stock', BadRequestWithDetailsException);
            }

            await this.prisma.cartItems.update({
                where: { Id: cartItemId },
                data: { Quantity: request.quantity },
            });

            return { success: true, data: cartItemId };
        }, 'errors.cart.update');
    }

    async removeFromCart(userId: string, cartItemId: string): Promise<BaseResponse<string>> {
        return this.err.wrap(async () => {
            const cartItem = await this.prisma.cartItems.findFirst({
                where: { Id: cartItemId, UserId: userId },
            });

            if (!cartItem) {
                this.err.throw('errors.cart.not_found', NotFoundWithDetailsException);
            }

            await this.prisma.cartItems.delete({ where: { Id: cartItemId } });
            return { success: true, data: cartItemId };
        }, 'errors.cart.remove');
    }

    async clearCart(userId: string): Promise<BaseResponse<string>> {
        return this.err.wrap(async () => {
            await this.prisma.cartItems.deleteMany({
                where: { UserId: userId },
            });

            return { success: true, message: 'Cart cleared successfully' };
        }, 'errors.cart.clear');
    }
}