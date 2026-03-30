import { Module } from '@nestjs/common';
import { UserLogAIService } from 'src/infrastructure/domain/user-log/user-log-ai.service';
import { UserLogModule } from 'src/infrastructure/domain/user-log/user-log.module';

@Module({
  imports: [UserLogModule],
  providers: [UserLogAIService],
  exports: [UserLogAIService]
})
export class UserLogAIModule {}
