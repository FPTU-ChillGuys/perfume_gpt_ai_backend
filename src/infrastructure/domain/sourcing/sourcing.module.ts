import { Module } from '@nestjs/common';
import { SourcingCatalogService } from './sourcing-catalog.service';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [],
  providers: [SourcingCatalogService],
  exports: [SourcingCatalogService],
})
export class SourcingModule { }
