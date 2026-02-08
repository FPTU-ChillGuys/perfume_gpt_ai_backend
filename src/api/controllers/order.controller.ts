import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Req
} from '@nestjs/common';
import { Request } from 'express';
import { OrderRequest } from 'src/application/dtos/request/order.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { OrderResponse } from 'src/application/dtos/response/order.response';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { OrderService } from 'src/infrastructure/servicies/order.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { extractTokenFromHeader } from 'src/infrastructure/utils/extract-token';

@Controller('orders')
export class OrderController {
  constructor(
    private orderService: OrderService,
    @Inject(AI_SERVICE) private aiService: AIService
  ) {}

  @Get('')
  @ApiBaseResponse(PagedResult<OrderResponse>)
  //Get orders
  async getAllOrders(
    @Req() request: Request,
    @Query('orderRequest') orderRequest: OrderRequest
  ) {
    return await this.orderService.getAllOrders(
      orderRequest,
      extractTokenFromHeader(request!) ?? ''
    );
  }

  @Get('user/:userId')
  @ApiBaseResponse(PagedResult<OrderResponse>)
  //Get orders by user id
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

  @Get('summary/ai')
  @ApiBaseResponse(String)
  //Get AI generated order summary
  async getAIOrderSummary(
    @Req() request: Request,
    @Query('userId') userId: string
  ) {
    const ordersResponse =
      await this.orderService.createOrderReportFromGetOrderDetailsWithOrdersByUserId(
        userId,
        extractTokenFromHeader(request!) ?? ''
      );

    if (!ordersResponse.success) {
      return {
        success: false,
        error: 'Failed to retrieve orders for AI summary'
      };
    }

    const aiPrompt = `Generate a comprehensive summary of the following order details, highlighting key insights such as purchasing patterns, frequently ordered items, and any notable trends that could inform future business strategies:\n\n${ordersResponse.payload}`;

    const aiResponse = await this.aiService.textGenerateFromPrompt(aiPrompt);

    if (!aiResponse.success) {
      return {
        success: false,
        error: 'Failed to generate AI order summary'
      };
    }
    return { success: true, data: aiResponse.data };
  }
}
