import { Module } from '@nestjs/common';
import { UnitOfWorkModule } from 'src/infrastructure/domain/common/unit-of-work.module';
import { AIAcceptanceService } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.service';
import { ProviderModule } from 'src/infrastructure/domain/common/provider.module';

@Module({
  imports: [ProviderModule, UnitOfWorkModule],
  providers: [AIAcceptanceService],
  exports: [AIAcceptanceService]
})
export class AIAcceptanceModule {}
