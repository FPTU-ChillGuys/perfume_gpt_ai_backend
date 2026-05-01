import { Module } from '@nestjs/common';
import { RestockService } from 'src/infrastructure/domain/restock/restock.service';
import { RestockAnalyticsRepository } from 'src/infrastructure/domain/restock/restock-analytics.repository';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ProviderModule } from 'src/infrastructure/domain/common/provider.module';

@Module({
  imports: [PrismaModule, ProviderModule],
  providers: [RestockService, RestockAnalyticsRepository],
  exports: [RestockService]
})
export class RestockModule { }
