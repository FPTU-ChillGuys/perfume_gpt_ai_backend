import { Module } from '@nestjs/common';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { UnitOfWorkModule } from 'src/infrastructure/domain/common/unit-of-work.module';
import { ProviderModule } from 'src/infrastructure/domain/common/provider.module';

@Module({
  imports: [ProviderModule, UnitOfWorkModule],
  providers: [AdminInstructionService],
  exports: [AdminInstructionService]
})
export class AdminInstructionModule {}
