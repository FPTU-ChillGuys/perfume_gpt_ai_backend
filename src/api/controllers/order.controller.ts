import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Req
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { OrderRequest } from 'src/application/dtos/request/order.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { OrderResponse } from 'src/application/dtos/response/order.response';
import { orderSummaryPrompt } from 'src/application/constant/prompts';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { OrderService } from 'src/infrastructure/servicies/order.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { extractTokenFromHeader } from 'src/infrastructure/utils/extract-token';

@ApiTags('Orders')
@Controller('orders')
export class OrderController {
  constructor(
    private orderService: OrderService,
    @Inject(AI_SERVICE) private aiService: AIService
  ) {}

  /** Lấy danh sách tất cả đơn hàng */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả đơn hàng' })
  @ApiBaseResponse(PagedResult<OrderResponse>)
  async getAllOrders(
    @Req() request: Request,
    @Query('orderRequest') orderRequest: OrderRequest
  ) {
    return await this.orderService.getAllOrders(
      orderRequest,
      extractTokenFromHeader(request!) ?? ''
    );
  }

  /** Lấy danh sách đơn hàng theo userId */
  @Get('user/:userId')
  @ApiOperation({ summary: 'Lấy đơn hàng theo user ID' })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiBaseResponse(PagedResult<OrderResponse>)
  async getOrdersByUserId(
    @Req() request: Request,
    @Param('userId') userId: string,
    @Query('orderRequest') orderRequest: OrderRequest
  ) {
    return await this.orderService.getOrdersByUserId(
      userId,
      orderRequest,
      extractTokenFromHeader(request!) ?? ''
    );
  }

  /** Tạo báo cáo tóm tắt đơn hàng bằng AI */
  @Get('summary/ai')
  @ApiOperation({ summary: 'Tạo báo cáo tóm tắt đơn hàng bằng AI' })
  @ApiQuery({ name: 'userId', description: 'ID của người dùng' })
  @ApiBaseResponse(String)
  async getAIOrderSummary(
    @Req() request: Request,
    @Query('userId') userId: string
  ) {

    // Lay tat ca don hang cua user
    const ordersResponse =
      await this.orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
        userId,
        extractTokenFromHeader(request!) ?? ''
      );

    if (!ordersResponse.success) {
      return {
        success: false,
        error: 'Failed to retrieve orders for AI summary'
      };
    }

    // Goi AI service de tao summary
    const aiResponse = await this.aiService.textGenerateFromPrompt(
      orderSummaryPrompt(ordersResponse.data ?? '')
    );

    if (!aiResponse.success) {
      return {
        success: false,
        error: 'Failed to generate AI order summary'
      };
    }
    return { success: true, data: aiResponse.data };
  }
}
