import { Module } from '@nestjs/common';
import { RestockService } from 'src/infrastructure/domain/restock/restock.service';
import { RestockAnalyticsRepository } from 'src/infrastructure/domain/restock/restock-analytics.repository';
import { PrismaModule } from 'src/prisma/prisma.module';
@Module({
  imports: [PrismaModule],
  providers: [RestockService, RestockAnalyticsRepository],
  exports: [RestockService]
})
export class RestockModule {}
