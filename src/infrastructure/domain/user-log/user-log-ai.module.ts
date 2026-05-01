import { Module } from '@nestjs/common';
import { UserLogAIService } from 'src/infrastructure/domain/user-log/user-log-ai.service';
import { UserLogModule } from 'src/infrastructure/domain/user-log/user-log.module';
import { ProviderModule } from 'src/infrastructure/domain/common/provider.module';

@Module({
  imports: [UserLogModule, ProviderModule],
  providers: [UserLogAIService],
  exports: [UserLogAIService]
})
export class UserLogAIModule {}
