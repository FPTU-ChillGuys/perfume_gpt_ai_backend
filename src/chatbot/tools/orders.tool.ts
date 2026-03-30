import { Injectable, Logger } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { OrderRequest } from 'src/application/dtos/request/order.request';
import {
  OrderDetailResponse,
  OrderListItemResponse,
  OrderResponse
} from 'src/application/dtos/response/order.response';
import { OrderService } from 'src/infrastructure/domain/order/order.service';
import { UserService } from 'src/infrastructure/domain/user/user.service';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { encodeToolOutput } from '../utils/toon-encoder.util';
import * as z from 'zod';

@Injectable()
export class OrderTool {
  private readonly logger = new Logger(OrderTool.name);

  constructor(private readonly orderService: OrderService, private readonly userService: UserService) { }

  getOrdersByUserId: Tool = tool({
    description: 'Get all orders for a specific user with pagination and sorting. ' +
      'Returns orders with TOON compression for large datasets to optimize token usage.',
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user'),
      pageNumber: z.number().min(1),
      pageSize: z.number().min(1).max(100),
      sortBy: z.string().nullable(),
      sortOrder: z.enum(['asc', 'desc']),
      isDescending: z.boolean(),
    }),
    execute: async (input) => {
      this.logger.log(`[getOrdersByUserId] called for userId: ${input.userId}`);
      return await funcHandlerAsync(
        async () => {
          const response = await this.orderService.getOrdersByUserId(
            input.userId,
            new OrderRequest()
          );
          this.logger.debug(`[getOrdersByUserId] response items count: ${response.payload?.items?.length ?? 0}`);
          if (!response.success) {
            return { success: false, error: `Failed to fetch orders for user ${input.userId}.` };
          }

          const items = response.payload?.items || [];

          // Encode large datasets to optimize token usage
          if (items.length > 5) {
            const encodingResult = encodeToolOutput(items);
            return {
              success: true,
              encodedData: encodingResult.encoded
            };
          }

          return { success: true, data: items };
        },
        'Error occurred while fetching user orders.',
        true
      );
    }
  });

  getOrderById: Tool = tool({
    description: 'Get detailed information about a specific order by its ID.',
    inputSchema: z.object({
      orderId: z.string().describe('The ID of the order'),
    }),
    execute: async (input) => {
      this.logger.log(`[getOrderById] called for orderId: ${input.orderId}`);
      return await funcHandlerAsync(
        async () => {
          const response = await this.orderService.getOrderById(input.orderId);
          console.log('OrderTool - getOrderById response:', response.payload);
          if (!response.success) {
            return { success: false, error: `Failed to fetch order ${input.orderId}.` };
          }
          return { success: true, data: response.payload || {} };
        },
        'Error occurred while fetching order details.',
        true
      );
    }
  });

  getOrderDetailsWithOrdersByUserId: Tool = tool({
    description:
      'Get all detailed order information for a user including items, amounts, and status. ' +
      'Large datasets are TOON-compressed to optimize token usage.',
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user'),
    }),
    execute: async (input) => {
      this.logger.log(`[getOrderDetailsWithOrdersByUserId] called for userId: ${input.userId}`);
      return await funcHandlerAsync(
        async () => {
          const response = await this.orderService.getOrderDetailsWithOrdersByUserId(
            input.userId
          );
          this.logger.debug(`[getOrderDetailsWithOrdersByUserId] response data count: ${Array.isArray(response.data) ? response.data.length : 0}`);
          if (!response.success) {
            return { success: false, error: `Failed to fetch order details for user ${input.userId}.` };
          }

          const data = response.data || [];

          // Encode large datasets to optimize token usage
          if (Array.isArray(data) && data.length > 5) {
            const encodingResult = encodeToolOutput(data);
            return {
              success: true,
              encodedData: encodingResult.encoded
            };
          }

          return { success: true, data };
        },
        'Error occurred while fetching order details.',
        true
      );
    }
  });

  getOrderReport: Tool = tool({
    description:
      'Generate a text report of all orders for a user including order details, items, and totals.',
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user'),
    }),
    execute: async (input) => {
      this.logger.log(`[getOrderReport] called for userId: ${input.userId}`);
      return await funcHandlerAsync(
        async () => {
          const response = await this.orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
            input.userId
          );
          this.logger.debug(`[getOrderReport] response received`);
          if (!response.success) {
            return { success: false, error: `Failed to generate order report for user ${input.userId}.` };
          }
          return { success: true, data: response.data || '' };
        },
        'Error occurred while generating order report.',
        true
      );
    }
  });

  addCartItems: Tool = tool({
    description:
      'Add multiple items to cart for a user. Each item will be added individually with its variant ID and quantity.',
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user'),
      items: z
        .array(
          z.object({
            variantId: z.string().describe('The ID of the product variant'),
            quantity: z.number().min(1).describe('The quantity to add'),
          })
        )
        .min(1)
        .describe('Array of items to add to cart, each with variantId and quantity'),
    }),
    execute: async (input) => {
      this.logger.log(
        `[addCartItems] called for userId: ${input.userId} with ${input.items.length} items`
      );

      //Check user existence before processing cart additions
      const userExists = await this.userService.isUserExistedByUserId(input.userId);
      if (userExists.success && !userExists.payload) {
        this.logger.warn(`[addCartItems] User ${input.userId} does not exist or does not signed up.`);
        return { success: false, error: `User ${input.userId} not found or does not signed up..` };
      }

      return await funcHandlerAsync(
        async () => {
          const results: Array<{
            variantId: string;
            quantity: number;
            status: string;
            message: string;
          }> = [];
          const errors: Array<{
            variantId: string;
            status: string;
            error: string;
          }> = [];

          // Loop through each item and add it to cart
          for (const item of input.items) {
            try {
              this.logger.debug(
                `[addCartItems] Adding variant ${item.variantId} (qty: ${item.quantity}) for user ${input.userId}`
              );
              const response = await this.orderService.addCartItemsForAi({
                userId: input.userId,
                variantId: item.variantId,
                quantity: item.quantity,
              });

              if (response.success) {
                results.push({
                  variantId: item.variantId,
                  quantity: item.quantity,
                  status: 'success',
                  message: response.payload || 'Item added successfully',
                });
              } else {
                errors.push({
                  variantId: item.variantId,
                  status: 'failed',
                  error: response.error || 'Failed to add item',
                });
              }
            } catch (error) {
              errors.push({
                variantId: item.variantId,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error occurred',
              });
            }
          }

          this.logger.debug(
            `[addCartItems] completed: ${results.length} successful, ${errors.length} failed`
          );

          // Return results with success status and detailed feedback
          const hasErrors = errors.length > 0;
          return {
            success: !hasErrors || results.length > 0, // Success if at least some items were added
            data: {
              successCount: results.length,
              failureCount: errors.length,
              totalItems: input.items.length,
              successful: results,
              failed: errors,
              summary: `Successfully added ${results.length} of ${input.items.length} items to cart.${errors.length > 0 ? ` ${errors.length} item(s) failed to add.` : ''
                }`,
            },
          };
        },
        'Error occurred while adding items to cart.',
        true
      );
    }
  });
}
