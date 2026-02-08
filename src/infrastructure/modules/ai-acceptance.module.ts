import { Module } from '@nestjs/common';
import { UnitOfWorkModule } from './unit-of-work.module';
import { AIAcceptanceService } from '../servicies/ai-acceptance.service';

@Module({
  imports: [UnitOfWorkModule],
  providers: [AIAcceptanceService],
  exports: [AIAcceptanceService]
})
export class AIAcceptanceModule {}
