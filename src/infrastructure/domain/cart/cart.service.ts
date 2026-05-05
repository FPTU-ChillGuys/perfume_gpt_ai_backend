import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddToCartRequest } from 'src/application/dtos/request/cart/add-to-cart.request';
import { UpdateCartItemRequest } from 'src/application/dtos/request/cart/update-cart-item.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';
import {
  NotFoundWithDetailsException,
  BadRequestWithDetailsException
} from 'src/application/common/exceptions/http-with-details.exception';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);
  private redisPublisher: Redis | null = null;
  private publisherInit: Promise<Redis | null> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly err: I18nErrorHandler,
    private readonly configService: ConfigService
  ) {}

  private async getPublisher(): Promise<Redis | null> {
    if (this.publisherInit === null) {
      this.publisherInit = this.initPublisher();
    }
    return this.publisherInit;
  }

  private async initPublisher(): Promise<Redis | null> {
    try {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = this.configService.get<number>('REDIS_PORT', 6379);
      const client = new Redis({ host, port, lazyConnect: true });
      await client.connect();
      this.redisPublisher = client;
      return client;
    } catch {
      this.logger.warn('[CartService] Redis publisher disabled — cart events will not be broadcast.');
      return null;
    }
  }

  private async publishCartUpdated(userId: string): Promise<void> {
    const publisher = await this.getPublisher();
    if (!publisher) return;
    try {
      const result = await this.prisma.cartItems.aggregate({
        where: { UserId: userId },
        _sum: { Quantity: true }
      });
      const count = result._sum.Quantity ?? 0;
      const payload = JSON.stringify({ userId, cartItemCount: count });
      await publisher.publish('cart:updated', payload);
    } catch {
      // fire-and-forget — never break the cart flow for Redis
    }
  }

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
              Media: { where: { IsPrimary: true } }
            }
          }
        }
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
        subTotal: Number(item.ProductVariants.BasePrice) * item.Quantity
      }));

      const totalAmount = items.reduce((sum, item) => sum + item.subTotal, 0);

      return {
        success: true,
        data: {
          items,
          totalAmount
        }
      };
    }, 'errors.cart.get');
  }

  async addToCart(
    userId: string,
    request: AddToCartRequest
  ): Promise<BaseResponse<string>> {
    return this.err.wrap(async () => {
      // Check if user is admin/staff — backoffice accounts cannot add to cart
      const userWithRoles = await this.prisma.aspNetUsers.findUnique({
        where: { Id: userId },
        select: {
          AspNetUserRoles: {
            select: {
              AspNetRoles: { select: { Name: true } }
            }
          }
        }
      });

      if (!userWithRoles) {
        // Guest user — userId không tồn tại trong hệ thống
        this.err.throw(
          'errors.cart.user_not_found',
          BadRequestWithDetailsException
        );
      }

      const isBackOffice = userWithRoles.AspNetUserRoles.some(
        (ur) =>
          ur.AspNetRoles?.Name &&
          ['admin', 'staff'].includes(ur.AspNetRoles.Name.toLowerCase())
      );

      if (isBackOffice) {
        this.err.throw(
          'errors.cart.admin_not_allowed',
          BadRequestWithDetailsException
        );
      }

      const variant = await this.prisma.productVariants.findFirst({
        where: { Id: request.variantId, IsDeleted: false },
        include: { Stocks: true }
      });

      if (!variant) {
        this.err.throw('errors.cart.not_found', NotFoundWithDetailsException);
      }

      if (variant.Status !== 'Active') {
        this.err.throw(
          'errors.cart.variant_unavailable',
          BadRequestWithDetailsException
        );
      }

      const existingItem = await this.prisma.cartItems.findFirst({
        where: { UserId: userId, VariantId: request.variantId }
      });

      const totalQuantity = existingItem
        ? existingItem.Quantity + request.quantity
        : request.quantity;

      if (!variant.Stocks || variant.Stocks.TotalQuantity < totalQuantity) {
        this.err.throw(
          'errors.cart.insufficient_stock',
          BadRequestWithDetailsException
        );
      }

      if (existingItem) {
        await this.prisma.cartItems.update({
          where: { Id: existingItem.Id },
          data: { Quantity: totalQuantity }
        });
        await this.publishCartUpdated(userId);
        return { success: true, data: existingItem.Id };
      }

      const newItem = await this.prisma.cartItems.create({
        data: {
          Id: uuidv4(),
          UserId: userId,
          VariantId: request.variantId,
          Quantity: request.quantity
        }
      });

      await this.publishCartUpdated(userId);
      return { success: true, data: newItem.Id };
    }, 'errors.cart.add_item');
  }

  async updateCartItem(
    userId: string,
    cartItemId: string,
    request: UpdateCartItemRequest
  ): Promise<BaseResponse<string>> {
    return this.err.wrap(async () => {
      const cartItem = await this.prisma.cartItems.findFirst({
        where: { Id: cartItemId, UserId: userId },
        include: { ProductVariants: { include: { Stocks: true } } }
      });

      if (!cartItem) {
        this.err.throw('errors.cart.not_found', NotFoundWithDetailsException);
      }

      if (request.quantity <= 0) {
        await this.prisma.cartItems.delete({ where: { Id: cartItemId } });
        await this.publishCartUpdated(userId);
        return { success: true, data: cartItemId };
      }

      if (
        !cartItem.ProductVariants.Stocks ||
        cartItem.ProductVariants.Stocks.TotalQuantity < request.quantity
      ) {
        this.err.throw(
          'errors.cart.insufficient_stock',
          BadRequestWithDetailsException
        );
      }

      await this.prisma.cartItems.update({
        where: { Id: cartItemId },
        data: { Quantity: request.quantity }
      });

      await this.publishCartUpdated(userId);
      return { success: true, data: cartItemId };
    }, 'errors.cart.update');
  }

  async removeFromCart(
    userId: string,
    cartItemId: string
  ): Promise<BaseResponse<string>> {
    return this.err.wrap(async () => {
      const cartItem = await this.prisma.cartItems.findFirst({
        where: { Id: cartItemId, UserId: userId }
      });

      if (!cartItem) {
        this.err.throw('errors.cart.not_found', NotFoundWithDetailsException);
      }

      await this.prisma.cartItems.delete({ where: { Id: cartItemId } });
      await this.publishCartUpdated(userId);
      return { success: true, data: cartItemId };
    }, 'errors.cart.remove');
  }

  async clearCart(userId: string): Promise<BaseResponse<string>> {
    return this.err.wrap(async () => {
      await this.prisma.cartItems.deleteMany({
        where: { UserId: userId }
      });

      await this.publishCartUpdated(userId);
      return { success: true, message: 'Cart cleared successfully' };
    }, 'errors.cart.clear');
  }
}
