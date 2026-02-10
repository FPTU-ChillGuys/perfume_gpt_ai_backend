import { Module } from '@nestjs/common';
import { AdminInstructionService } from '../servicies/admin-instruction.service';
import { UnitOfWorkModule } from './unit-of-work.module';

@Module({
  imports: [UnitOfWorkModule],
  providers: [AdminInstructionService],
  exports: [AdminInstructionService]
})
export class AdminInstructionModule {}
