import { Module } from "@nestjs/common";
import { InventoryService } from 'src/infrastructure/domain/inventory/inventory.service';
import { UnitOfWorkModule } from 'src/infrastructure/domain/common/unit-of-work.module';
import { AIModule } from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionModule } from 'src/infrastructure/domain/admin-instruction/admin-instruction.module';
import { InventoryTool } from 'src/chatbot/tools/inventory.tool';
import { RestockModule } from 'src/infrastructure/domain/restock/restock.module';
import { NatsModule } from '../common/nats/nats.module';
import { SourcingModule } from '../sourcing/sourcing.module';
import { InventoryNatsRepository } from '../repositories/nats/inventory-nats.repository';

@Module({
  imports: [UnitOfWorkModule, AIModule, AdminInstructionModule, RestockModule, SourcingModule, NatsModule],
  providers: [InventoryService, InventoryTool, InventoryNatsRepository],
  exports: [InventoryService, InventoryTool, InventoryNatsRepository]
})
export class InventoryModule { }
