import { Injectable } from '@nestjs/common';
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
  constructor(private readonly orderService: OrderService) {}

//   getAllOrders: Tool = tool({
//     description:
//       'Retrieve a list of all orders for the authenticated user with pagination and sorting.',
//     inputSchema: z.object({
//       pageNumber: z.number().min(1).optional().default(1),
//       pageSize: z.number().min(1).max(100).optional().default(10),
//       sortBy: z.string().optional(),
//       sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
//       isDescending: z.boolean().optional().default(false),
//       authToken: z.string().describe('JWT authentication token')
//     }),
//     execute: async (input) => {
//       return await funcHandlerAsync(
//         async () => {
//           const response = await this.orderService.getAllOrders(
//             new OrderRequest(),
//             input.authToken
//           );
//           console.log('OrderTool - getAllOrders response:', response.payload?.items);
//           if (!response.success) {
//             return { success: false, error: 'Failed to fetch orders.' };
//           }
//           return { success: true, data: response.payload?.items || [] };
//         },
//         'Error occurred while fetching orders.',
//         true
//       );
//     }
//   });

  getOrdersByUserId: Tool = tool({
    description: 'Get all orders for a specific user with pagination and sorting.',
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user'),
      pageNumber: z.number().min(1).optional().default(1),
      pageSize: z.number().min(1).max(100).optional().default(10),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
      isDescending: z.boolean().optional().default(false),
      authToken: z.string().describe('JWT authentication token')
    }),
    execute: async (input) => {
      return await funcHandlerAsync(
        async () => {
          const response = await this.orderService.getOrdersByUserId(
            input.userId,
            new OrderRequest(),
            input.authToken
          );
          console.log('OrderTool - getOrdersByUserId response:', response.payload?.items);
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
      authToken: z.string().describe('JWT authentication token')
    }),
    execute: async (input) => {
      return await funcHandlerAsync(
        async () => {
          const response = await this.orderService.getOrderById(
            input.orderId,
            input.authToken
          );
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
      authToken: z.string().describe('JWT authentication token')
    }),
    execute: async (input) => {
      return await funcHandlerAsync(
        async () => {
          const response = await this.orderService.getOrderDetailsWithOrdersByUserId(
            input.userId,
            input.authToken
          );
          console.log('OrderTool - getOrderDetailsWithOrdersByUserId response:', response.data);
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
      authToken: z.string().describe('JWT authentication token')
    }),
    execute: async (input) => {
      return await funcHandlerAsync(
        async () => {
          const response = await this.orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
            input.userId,
            input.authToken
          );
          console.log('OrderTool - getOrderReport response:', response.data);
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
