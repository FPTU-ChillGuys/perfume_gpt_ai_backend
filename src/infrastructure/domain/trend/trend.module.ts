import { Module } from '@nestjs/common';
import { TrendService } from 'src/infrastructure/domain/trend/trend.service';
import { AIModule } from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionModule } from 'src/infrastructure/domain/admin-instruction/admin-instruction.module';
import { UserLogModule } from 'src/infrastructure/domain/user-log/user-log.module';
import { InventoryModule } from 'src/infrastructure/domain/inventory/inventory.module';
import { RestockModule } from 'src/infrastructure/domain/restock/restock.module';
import { ProductModule } from 'src/infrastructure/domain/product/product.module';
import { AIAcceptanceModule } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.module';

@Module({
  imports: [AIModule, AdminInstructionModule, UserLogModule, InventoryModule, RestockModule, ProductModule, AIAcceptanceModule],
  providers: [TrendService],
  exports: [TrendService]
})
export class TrendModule { }
