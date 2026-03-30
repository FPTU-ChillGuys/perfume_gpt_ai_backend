import { Body, Controller, Get, Patch, Post, Delete, Param, Req, HttpCode, HttpStatus, ParseUUIDPipe, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CartService } from 'src/infrastructure/domain/cart/cart.service';
import { AddToCartRequest } from 'src/application/dtos/request/cart/add-to-cart.request';
import { UpdateCartItemRequest } from 'src/application/dtos/request/cart/update-cart-item.request';
import { getTokenPayloadFromRequest } from 'src/infrastructure/domain/utils/extract-token';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';

@ApiTags('Cart')
@Controller('cart')
export class CartController {
    constructor(private readonly cartService: CartService) { }

    @Get()
    @ApiOperation({ summary: 'Get current user cart' })
    async getCart(@Req() req: Request): Promise<BaseResponse<any>> {
        const userId = getTokenPayloadFromRequest(req)?.id;
        if (!userId) throw new UnauthorizedException();
        return this.cartService.getCart(userId);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Add item to cart' })
    async addToCart(@Req() req: Request, @Body() request: AddToCartRequest): Promise<BaseResponse<string>> {
        const userId = getTokenPayloadFromRequest(req)?.id;
        if (!userId) throw new UnauthorizedException();
        return this.cartService.addToCart(userId, request);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update cart item quantity' })
    async updateCartItem(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
        @Body() request: UpdateCartItemRequest,
    ): Promise<BaseResponse<string>> {
        const userId = getTokenPayloadFromRequest(req)?.id;
        if (!userId) throw new UnauthorizedException();
        return this.cartService.updateCartItem(userId, id, request);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Remove item from cart' })
    async removeFromCart(
        @Req() req: Request,
        @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    ): Promise<BaseResponse<string>> {
        const userId = getTokenPayloadFromRequest(req)?.id;
        if (!userId) throw new UnauthorizedException();
        return this.cartService.removeFromCart(userId, id);
    }

    @Delete()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Clear current user cart' })
    async clearCart(@Req() req: Request): Promise<BaseResponse<string>> {
        const userId = getTokenPayloadFromRequest(req)?.id;
        if (!userId) throw new UnauthorizedException();
        return this.cartService.clearCart(userId);
    }
}
