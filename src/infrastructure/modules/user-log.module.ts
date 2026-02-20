import { Module } from '@nestjs/common';
import { UserLogService } from '../servicies/user-log.service';
import { UnitOfWorkModule } from './unit-of-work.module';
import { AIModule } from './ai.module';
import { AdminInstructionModule } from './admin-instruction.module';

@Module({
  imports: [UnitOfWorkModule, AIModule, AdminInstructionModule],
  providers: [UserLogService],
  exports: [UserLogService]
})
export class UserLogModule {}
