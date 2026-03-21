import { Module } from '@nestjs/common';
import { TrendService } from '../servicies/trend.service';
import { AIModule } from './ai.module';
import { AdminInstructionModule } from './admin-instruction.module';
import { UserLogModule } from './user-log.module';
import { InventoryModule } from './inventory.module';
import { RestockModule } from './restock.module';

@Module({
  imports: [AIModule, AdminInstructionModule, UserLogModule, InventoryModule, RestockModule],
  providers: [TrendService],
  exports: [TrendService]
})
export class TrendModule {}
