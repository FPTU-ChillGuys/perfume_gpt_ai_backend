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
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { OrderListItemResponse, OrderResponse } from 'src/application/dtos/response/order.response';
import { orderSummaryPrompt } from 'src/application/constant/prompts';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { OrderService } from 'src/infrastructure/servicies/order.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { extractTokenFromHeader } from 'src/infrastructure/utils/extract-token';
import { AIOrderSummaryStructuredResponse, AIResponseMetadata } from 'src/application/dtos/response/ai-structured.response';
import { isDataEmpty, INSUFFICIENT_DATA_MESSAGES } from 'src/infrastructure/utils/insufficient-data';

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
  @ApiQuery({ name: 'orderRequest', type: String, required: false, description: 'Tham số lọc đơn hàng' })
  @ApiBaseResponse(PagedResult<OrderResponse>)
  async getAllOrders(
    @Req() request: Request,
    @Query('orderRequest') orderRequest: OrderRequest
  ): Promise<BaseResponseAPI<PagedResult<OrderListItemResponse>>> {
    return await this.orderService.getAllOrders(
      orderRequest,
      extractTokenFromHeader(request!) ?? ''
    );
  }

  /** Lấy danh sách đơn hàng theo userId */
  @Get('user/:userId')
  @ApiOperation({ summary: 'Lấy đơn hàng theo user ID' })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiQuery({ name: 'orderRequest', type: String, required: false, description: 'Tham số lọc đơn hàng' })
  @ApiBaseResponse(PagedResult<OrderResponse>)
  async getOrdersByUserId(
    @Req() request: Request,
    @Param('userId') userId: string,
    @Query('orderRequest') orderRequest: OrderRequest
  ): Promise<BaseResponseAPI<PagedResult<OrderListItemResponse>>> {
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
  ): Promise<BaseResponse<string>> {

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

    if (isDataEmpty(ordersResponse.data)) {
      return { success: true, data: INSUFFICIENT_DATA_MESSAGES.ORDER_SUMMARY };
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

  /**
   * Tạo báo cáo tóm tắt đơn hàng bằng AI - Phiên bản có cấu trúc.
   * Trả về response kèm metadata (thời gian xử lý, userId).
   */
  @Get('summary/ai/structured')
  @ApiOperation({ summary: 'Tạo báo cáo tóm tắt đơn hàng AI có cấu trúc' })
  @ApiQuery({ name: 'userId', description: 'ID của người dùng' })
  @ApiBaseResponse(AIOrderSummaryStructuredResponse)
  async getStructuredAIOrderSummary(
    @Req() request: Request,
    @Query('userId') userId: string
  ): Promise<BaseResponse<AIOrderSummaryStructuredResponse>> {
    const startTime = Date.now();

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

    if (isDataEmpty(ordersResponse.data)) {
      const processingTimeMs = Date.now() - startTime;
      return {
        success: true,
        data: new AIOrderSummaryStructuredResponse({
          summary: INSUFFICIENT_DATA_MESSAGES.ORDER_SUMMARY,
          userId,
          generatedAt: new Date(),
          metadata: new AIResponseMetadata({ processingTimeMs })
        })
      };
    }

    const aiResponse = await this.aiService.textGenerateFromPrompt(
      orderSummaryPrompt(ordersResponse.data ?? '')
    );

    if (!aiResponse.success) {
      return {
        success: false,
        error: 'Failed to generate AI order summary'
      };
    }

    const processingTimeMs = Date.now() - startTime;

    const structuredResponse = new AIOrderSummaryStructuredResponse({
      summary: aiResponse.data ?? '',
      userId,
      generatedAt: new Date(),
      metadata: new AIResponseMetadata({ processingTimeMs })
    });

    return { success: true, data: structuredResponse };
  }
}
