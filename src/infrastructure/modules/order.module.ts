import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { OrderService } from "../servicies/order.service";
import { OrderTool } from "src/chatbot/utils/tools/orders.tool";

@Module({
  imports: [HttpModule],
  providers: [OrderService, OrderTool],
  exports: [OrderService, OrderTool]
})
export class OrderModule {}