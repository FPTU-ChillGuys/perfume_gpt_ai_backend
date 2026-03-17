import { Module } from '@nestjs/common';
import { UserLogAIService } from '../servicies/user-log-ai.service';
import { UserLogModule } from './user-log.module';

@Module({
  imports: [UserLogModule],
  providers: [UserLogAIService],
  exports: [UserLogAIService]
})
export class UserLogAIModule {}
