import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { InventoryService } from "../servicies/inventory.service";

@Module({
  imports: [HttpModule],
  providers: [InventoryService],
  exports: [InventoryService]
})
export class InventoryModule {}