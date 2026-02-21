import { Module } from "@nestjs/common";
import { OrderService } from "../servicies/order.service";
import { OrderTool } from "src/chatbot/utils/tools/orders.tool";

@Module({
  imports: [],
  providers: [OrderService, OrderTool],
  exports: [OrderService, OrderTool]
})
export class OrderModule {}