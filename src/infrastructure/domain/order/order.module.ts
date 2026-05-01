import { Module } from '@nestjs/common';
import { OrderService } from 'src/infrastructure/domain/order/order.service';
import { OrderTool } from 'src/chatbot/tools/orders.tool';
import { HttpModule } from '@nestjs/axios';
import { UserModule } from 'src/infrastructure/domain/user/user.module';
@Module({
  imports: [HttpModule, UserModule],
  providers: [OrderService, OrderTool],
  exports: [OrderService, OrderTool]
})
export class OrderModule {}
