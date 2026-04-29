import { Module } from "@nestjs/common";
import { InventoryService } from 'src/infrastructure/domain/inventory/inventory.service';
import { UnitOfWorkModule } from 'src/infrastructure/domain/common/unit-of-work.module';
import { AIModule } from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionModule } from 'src/infrastructure/domain/admin-instruction/admin-instruction.module';
import { InventoryTool } from 'src/chatbot/tools/inventory.tool';
import { RestockModule } from 'src/infrastructure/domain/restock/restock.module';
import { SlowStockModule } from 'src/infrastructure/domain/slow-stock/slow-stock.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SourcingModule } from 'src/infrastructure/domain/sourcing/sourcing.module';
import { InventoryPrismaRepository } from 'src/infrastructure/domain/repositories/inventory-prisma.repository';

@Module({
  imports: [UnitOfWorkModule, AIModule, AdminInstructionModule, RestockModule, SlowStockModule, PrismaModule, SourcingModule],
  providers: [InventoryService, InventoryTool, InventoryPrismaRepository],
  exports: [InventoryService, InventoryTool]
})
export class InventoryModule { }
