import { Module } from '@nestjs/common';
import { SlowStockService } from 'src/infrastructure/domain/slow-stock/slow-stock.service';
import { RestockModule } from 'src/infrastructure/domain/restock/restock.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
    imports: [PrismaModule, RestockModule],
    providers: [SlowStockService],
    exports: [SlowStockService]
})
export class SlowStockModule {}