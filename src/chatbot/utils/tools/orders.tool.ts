import { Injectable, Logger } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { OrderRequest } from 'src/application/dtos/request/order.request';
import {
  OrderDetailResponse,
  OrderListItemResponse,
  OrderResponse
} from 'src/application/dtos/response/order.response';
import { OrderService } from 'src/infrastructure/servicies/order.service';
import { funcHandlerAsync } from 'src/infrastructure/utils/error-handler';
import * as z from 'zod';

@Injectable()
export class OrderTool {
  private readonly logger = new Logger(OrderTool.name);

  constructor(private readonly orderService: OrderService) {}

  getOrdersByUserId: Tool = tool({
    description: 'Get all orders for a specific user with pagination and sorting.',
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user'),
      pageNumber: z.number().min(1).optional().default(1),
      pageSize: z.number().min(1).max(100).optional().default(10),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
      isDescending: z.boolean().optional().default(false),
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
          return { success: true, data: response.payload?.items || [] };
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
      'Get all detailed order information for a user including items, amounts, and status.',
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
          return { success: true, data: response.data || [] };
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
}
