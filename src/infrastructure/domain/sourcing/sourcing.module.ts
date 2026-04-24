import { Module } from '@nestjs/common';
import { SourcingCatalogService } from './sourcing-catalog.service';
import { NatsModule } from '../common/nats/nats.module';

@Module({
  imports: [NatsModule],
  controllers: [],
  providers: [SourcingCatalogService],
  exports: [SourcingCatalogService],
})
export class SourcingModule { }
