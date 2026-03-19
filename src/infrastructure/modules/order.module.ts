import { Module } from "@nestjs/common";
import { OrderService } from "../servicies/order.service";
import { OrderTool } from "src/chatbot/utils/tools/orders.tool";
import { HttpModule } from "@nestjs/axios";
import { UserModule } from "./user.module";

@Module({
  imports: [HttpModule, UserModule],
  providers: [OrderService, OrderTool],
  exports: [OrderService, OrderTool]
})
export class OrderModule {}