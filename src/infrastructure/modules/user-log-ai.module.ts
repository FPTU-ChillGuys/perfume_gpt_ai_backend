import { Module } from '@nestjs/common';
import { UserLogAIService } from '../servicies/user-log-ai.service';
import { UserLogModule } from './user-log.module';
import { AdminInstructionModule } from './admin-instruction.module';
import { AIModule } from './ai.module';

@Module({
  imports: [UserLogModule, AdminInstructionModule, AIModule],
  providers: [UserLogAIService],
  exports: [UserLogAIService]
})
export class UserLogAIModule {}
