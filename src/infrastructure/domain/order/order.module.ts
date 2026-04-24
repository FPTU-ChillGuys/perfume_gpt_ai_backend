import { Module } from "@nestjs/common";
import { OrderService } from 'src/infrastructure/domain/order/order.service';
import { OrderTool } from "src/chatbot/tools/orders.tool";
import { HttpModule } from "@nestjs/axios";
import { UserModule } from 'src/infrastructure/domain/user/user.module';

import { OrderNatsRepository } from '../repositories/nats/order-nats.repository';
import { NatsModule } from '../common/nats/nats.module';

@Module({
  imports: [HttpModule, UserModule, NatsModule],
  providers: [OrderService, OrderTool, OrderNatsRepository],
  exports: [OrderService, OrderTool, OrderNatsRepository]
})
export class OrderModule { }
