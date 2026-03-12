import { Module } from '@nestjs/common';
import { TrendService } from '../servicies/trend.service';
import { AIModule } from './ai.module';
import { AdminInstructionModule } from './admin-instruction.module';
import { UserLogModule } from './user-log.module';
import { InventoryModule } from './inventory.module';

@Module({
  imports: [AIModule, AdminInstructionModule, UserLogModule, InventoryModule],
  providers: [TrendService],
  exports: [TrendService]
})
export class TrendModule {}
