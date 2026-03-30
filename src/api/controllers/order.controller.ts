import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Query
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { OrderRequest } from 'src/application/dtos/request/order.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import {
  OrderListItemResponse,
  OrderResponse
} from 'src/application/dtos/response/order.response';
import {
  orderSummaryPrompt,
  INSTRUCTION_TYPE_ORDER
} from 'src/application/constant/prompts';
import { AI_SERVICE } from 'src/infrastructure/domain/ai/ai.module';
import { AIService } from 'src/infrastructure/domain/ai/ai.service';
import { OrderService } from 'src/infrastructure/domain/order/order.service';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { ApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';

import {
  AIOrderSummaryStructuredResponse,
  AIResponseMetadata
} from 'src/application/dtos/response/ai-structured.response';
import {
  isDataEmpty,
  INSUFFICIENT_DATA_MESSAGES
} from 'src/infrastructure/domain/utils/insufficient-data';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { Role } from 'src/application/common/Metadata';

@Role(['admin'])
@ApiTags('Orders')
@ApiBearerAuth('jwt')
@ApiUnauthorizedResponse({
  description: 'Token JWT không hợp lệ hoặc không được cung cấp'
})
@Controller('orders')
export class OrderController {
  constructor(
    private orderService: OrderService,
    @Inject(AI_SERVICE) private aiService: AIService,
    private readonly adminInstructionService: AdminInstructionService
  ) { }

  /** Lấy danh sách tất cả đơn hàng */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả đơn hàng' })
  @ApiBaseResponse(PagedResult<OrderResponse>)
  async getAllOrders(
    @Query() orderRequest: OrderRequest
  ): Promise<BaseResponseAPI<PagedResult<OrderListItemResponse>>> {
    return await this.orderService.getAllOrders(orderRequest);
  }

  /** Lấy danh sách đơn hàng theo userId */
  @Get('user/:userId')
  @ApiOperation({ summary: 'Lấy đơn hàng theo user ID' })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiBaseResponse(PagedResult<OrderResponse>)
  async getOrdersByUserId(
    @Param('userId') userId: string,
    @Query() orderRequest: OrderRequest
  ): Promise<BaseResponseAPI<PagedResult<OrderListItemResponse>>> {
    return await this.orderService.getOrdersByUserId(userId, orderRequest);
  }

  private async fetchAndGenerateOrderSummary(userId: string, endpoint: string) {
    const startTime = Date.now();
    const ordersResponse = await this.orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(userId);

    if (!ordersResponse.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to retrieve orders for AI summary',
        { userId, service: 'OrderService', endpoint }
      );
    }

    if (isDataEmpty(ordersResponse.data)) {
      return { summary: INSUFFICIENT_DATA_MESSAGES.ORDER_SUMMARY, processingTimeMs: Date.now() - startTime };
    }

    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_ORDER);
    const aiResponse = await this.aiService.textGenerateFromPrompt(orderSummaryPrompt(ordersResponse.data ?? ''), adminPrompt);

    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to generate AI order summary',
        { userId, service: 'AIService', endpoint }
      );
    }

    return { summary: aiResponse.data ?? '', processingTimeMs: Date.now() - startTime };
  }

  /** Tạo báo cáo tóm tắt đơn hàng bằng AI */
  @Get('summary/ai')
  @ApiOperation({ summary: 'Tạo báo cáo tóm tắt đơn hàng bằng AI' })
  @ApiQuery({ name: 'userId', description: 'ID của người dùng' })
  @ApiBaseResponse(String)
  async getAIOrderSummary(
    @Query('userId') userId: string
  ): Promise<BaseResponse<string>> {
    const result = await this.fetchAndGenerateOrderSummary(userId, 'orders/summary/ai');
    return Ok(result.summary);
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
    @Query('userId') userId: string
  ): Promise<BaseResponse<AIOrderSummaryStructuredResponse>> {
    const result = await this.fetchAndGenerateOrderSummary(userId, 'orders/summary/ai/structured');

    const structuredResponse = new AIOrderSummaryStructuredResponse({
      summary: result.summary,
      userId,
      generatedAt: new Date(),
      metadata: new AIResponseMetadata({ processingTimeMs: result.processingTimeMs })
    });

    return Ok(structuredResponse);
  }
}
