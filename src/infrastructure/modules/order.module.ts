import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { OrderService } from "../servicies/order.service";

@Module({
  imports: [HttpModule],
  providers: [OrderService],
  exports: [OrderService]
})
export class OrderModule {}