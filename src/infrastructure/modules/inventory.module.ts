import { Module } from "@nestjs/common";
import { InventoryService } from "../servicies/inventory.service";
import { UnitOfWorkModule } from "./unit-of-work.module";

@Module({
  imports: [UnitOfWorkModule],
  providers: [InventoryService],
  exports: [InventoryService]
})
export class InventoryModule {}