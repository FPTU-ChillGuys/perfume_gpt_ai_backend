import { Module } from "@nestjs/common";
import { InventoryService } from "../servicies/inventory.service";
import { UnitOfWorkModule } from "./unit-of-work.module";
import { AIModule } from "./ai.module";
import { AdminInstructionModule } from "./admin-instruction.module";

@Module({
  imports: [UnitOfWorkModule, AIModule, AdminInstructionModule],
  providers: [InventoryService],
  exports: [InventoryService]
})
export class InventoryModule {}
