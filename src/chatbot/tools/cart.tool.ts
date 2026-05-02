import { Injectable, Logger } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { CartService } from 'src/infrastructure/domain/cart/cart.service';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';
import * as z from 'zod';

@Injectable()
export class CartTool {
  private readonly logger = new Logger(CartTool.name);

  constructor(
    private readonly cartService: CartService,
    private readonly err: I18nErrorHandler
  ) {}

  addToCart: Tool = tool({
    description:
      "Add one or more product variants to the user's shopping cart. " +
      'Requires userId and an array of items (each with variantId and quantity). ' +
      'Use this tool when a user expresses a desire to buy or add products to their cart.',
    inputSchema: z.object({
      userId: z.string().uuid().describe('The ID of the user.'),
      items: z
        .array(
          z.object({
            variantId: z
              .string()
              .uuid()
              .describe('The ID of the product variant to add.'),
            quantity: z
              .number()
              .min(1)
              .default(1)
              .describe('The quantity to add.')
          })
        )
        .min(1)
        .describe('An array of items to add to the cart.')
    }),
    execute: async (input) => {
      this.logger.log(
        `[addToCart] called for user ${input.userId} with ${input.items.length} items`
      );
      return await this.err.wrap(async () => {
        const results: any[] = [];
        for (const item of input.items) {
          const response = await this.cartService.addToCart(input.userId, {
            variantId: item.variantId,
            quantity: item.quantity
          });
          results.push({
            variantId: item.variantId,
            success: response.success,
            error: response.error
          });
        }
        return { success: true, data: results };
      }, 'errors.cart.tool_add');
    }
  });

  getCart: Tool = tool({
    description:
      "Retrieve the current items in the user's shopping cart. " +
      'Use this tool when a user asks what is in their cart or wants to see their cart total.',
    inputSchema: z.object({
      userId: z.string().uuid().describe('The ID of the user.')
    }),
    execute: async (input) => {
      this.logger.log(`[getCart] called for user ${input.userId}`);
      return await this.err.wrap(async () => {
        const response = await this.cartService.getCart(input.userId);
        return response;
      }, 'errors.cart.tool_get');
    }
  });

  clearCart: Tool = tool({
    description: "Remove all items from the user's shopping cart.",
    inputSchema: z.object({
      userId: z.string().uuid().describe('The ID of the user.')
    }),
    execute: async (input) => {
      this.logger.log(`[clearCart] called for user ${input.userId}`);
      return await this.err.wrap(async () => {
        const response = await this.cartService.clearCart(input.userId);
        return response;
      }, 'errors.cart.tool_clear');
    }
  });
}
