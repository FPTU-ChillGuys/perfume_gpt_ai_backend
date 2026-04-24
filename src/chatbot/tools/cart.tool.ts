import { Injectable, Logger } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { CartService } from 'src/infrastructure/domain/cart/cart.service';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { AddToCartResult, CartItemResult } from 'src/application/dtos/response/cart-tool.response';
import * as z from 'zod';

@Injectable()
export class CartTool {
    private readonly logger = new Logger(CartTool.name);

    constructor(private readonly cartService: CartService) { }

    addToCart: Tool = tool({
        description: 'Add one or more product variants to the user\'s shopping cart. ' +
            'Requires userId and an array of items (each with variantId and quantity). ' +
            'Use this tool when a user expresses a desire to buy or add products to their cart.',
        inputSchema: z.object({
            userId: z.string().uuid().describe('The ID of the user.'),
            items: z.array(z.object({
                variantId: z.string().uuid().describe('The ID of the product variant to add.'),
                quantity: z.number().min(1).default(1).describe('The quantity to add.'),
            })).min(1).describe('An array of items to add to the cart.'),
        }),
        execute: async (input) => {
            this.logger.log(`[addToCart] called for user ${input.userId} with ${input.items.length} items`);
            return await funcHandlerAsync(
                async () => {
                    const results: CartItemResult[] = [];
                    for (const item of input.items) {
                        const response = await this.cartService.addToCart(input.userId, {
                            variantId: item.variantId,
                            quantity: item.quantity,
                        });
                        results.push({
                            variantId: item.variantId,
                            success: response.success,
                            error: response.error ?? undefined,
                        });
                    }
                    return { success: true, data: results } as AddToCartResult;
                },
                'Error occurred while adding items to cart.',
                true,
            );
        },
    });

    getCart: Tool = tool({
        description: 'Retrieve the current items in the user\'s shopping cart. ' +
            'Use this tool when a user asks what is in their cart or wants to see their cart total.',
        inputSchema: z.object({
            userId: z.string().uuid().describe('The ID of the user.'),
        }),
        execute: async (input) => {
            this.logger.log(`[getCart] called for user ${input.userId}`);
            return await funcHandlerAsync(
                async () => {
                    const response = await this.cartService.getCart(input.userId);
                    return response;
                },
                'Error occurred while fetching cart items.',
                true,
            );
        },
    });

    clearCart: Tool = tool({
        description: 'Remove all items from the user\'s shopping cart.',
        inputSchema: z.object({
            userId: z.string().uuid().describe('The ID of the user.'),
        }),
        execute: async (input) => {
            this.logger.log(`[clearCart] called for user ${input.userId}`);
            return await funcHandlerAsync(
                async () => {
                    const response = await this.cartService.clearCart(input.userId);
                    return response;
                },
                'Error occurred while clearing cart.',
                true,
            );
        },
    });
}
