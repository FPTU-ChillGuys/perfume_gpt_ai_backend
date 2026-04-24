import { Module } from '@nestjs/common';
import { RestockService } from 'src/infrastructure/domain/restock/restock.service';
import { NatsModule } from '../common/nats/nats.module';
import { InventoryNatsRepository } from '../repositories/nats/inventory-nats.repository';
import { SalesNatsRepository } from '../repositories/nats/sales-nats.repository';

@Module({
  imports: [NatsModule],
  providers: [RestockService, InventoryNatsRepository, SalesNatsRepository],
  exports: [RestockService]
})
export class RestockModule { }
