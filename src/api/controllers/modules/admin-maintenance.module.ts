import { Module } from '@nestjs/common';
import { AdminMaintenanceController } from 'src/api/controllers/admin-maintenance.controller';
import { DictionaryModule } from 'src/infrastructure/domain/common/dictionary.module';
import { HybridSearchModule } from 'src/infrastructure/domain/hybrid-search/hybrid-search.module';

@Module({
  imports: [DictionaryModule, HybridSearchModule],
  controllers: [AdminMaintenanceController]
})
export class AdminMaintenanceModule {}
