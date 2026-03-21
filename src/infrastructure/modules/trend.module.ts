import { Module } from '@nestjs/common';
import { TrendService } from '../servicies/trend.service';
import { TrendNarrativeHelper } from '../helpers/trend-narrative.helper';
import { AIModule } from './ai.module';
import { AdminInstructionModule } from './admin-instruction.module';
import { UserLogModule } from './user-log.module';
import { InventoryModule } from './inventory.module';
import { ProductModule } from './product.module';
import { RestockModule } from './restock.module';

@Module({
  imports: [AIModule, AdminInstructionModule, UserLogModule, InventoryModule, ProductModule, RestockModule],
  providers: [TrendService, TrendNarrativeHelper],
  exports: [TrendService]
})
export class TrendModule {}
