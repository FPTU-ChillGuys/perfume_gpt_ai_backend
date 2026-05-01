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
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';
import { encodeToolOutput } from '../utils/toon-encoder.util';
import * as z from 'zod';

@Injectable()
export class OrderTool {
  private readonly logger = new Logger(OrderTool.name);

  constructor(private readonly orderService: OrderService, private readonly userService: UserService, private readonly err: I18nErrorHandler) { }

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
      return await this.err.wrap(
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

          if (items.length > 5) {
            const encodingResult = encodeToolOutput(items);
            return {
              success: true,
              encodedData: encodingResult.encoded
            };
          }

          return { success: true, data: items };
        },
        'errors.order.tool_fetch'
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
      return await this.err.wrap(
        async () => {
          const response = await this.orderService.getOrderById(input.orderId);
          if (!response.success) {
            return { success: false, error: `Failed to fetch order ${input.orderId}.` };
          }
          return { success: true, data: response.payload || {} };
        },
        'errors.order.tool_detail'
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
      return await this.err.wrap(
        async () => {
          const response = await this.orderService.getOrderDetailsWithOrdersByUserId(
            input.userId
          );
          this.logger.debug(`[getOrderDetailsWithOrdersByUserId] response data count: ${Array.isArray(response.data) ? response.data.length : 0}`);
          if (!response.success) {
            return { success: false, error: `Failed to fetch order details for user ${input.userId}.` };
          }

          const data = response.data || [];

          if (Array.isArray(data) && data.length > 5) {
            const encodingResult = encodeToolOutput(data);
            return {
              success: true,
              encodedData: encodingResult.encoded
            };
          }

          return { success: true, data };
        },
        'errors.order.tool_detail'
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
      return await this.err.wrap(
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
        'errors.order.tool_report'
      );
    }
  });
}
