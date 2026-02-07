import { Body, Controller, Get, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { OrderRequest } from 'src/application/dtos/request/order.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { OrderResponse } from 'src/application/dtos/response/order.response';
import { OrderService } from 'src/infrastructure/servicies/order.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { extractTokenFromHeader } from 'src/infrastructure/utils/extract-token';

@Controller('orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

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
}
