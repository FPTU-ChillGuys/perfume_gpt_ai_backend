import { Module } from '@nestjs/common';
import { SlowStockService } from 'src/infrastructure/domain/slow-stock/slow-stock.service';
import { SlowStockRepository } from 'src/infrastructure/domain/slow-stock/slow-stock.repository';
import { RestockModule } from 'src/infrastructure/domain/restock/restock.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ProviderModule } from 'src/infrastructure/domain/common/provider.module';

@Module({
    imports: [PrismaModule, RestockModule, ProviderModule],
    providers: [SlowStockService, SlowStockRepository],
    exports: [SlowStockService]
})
export class SlowStockModule {}