import { Module } from '@nestjs/common';
import { RestockService } from 'src/infrastructure/domain/restock/restock.service';
import { RedisModule } from '../common/redis/redis.module';
import { InventoryRedisRepository } from '../repositories/redis/inventory-redis.repository';
import { SalesRedisRepository } from '../repositories/redis/sales-redis.repository';

@Module({
  imports: [RedisModule],
  providers: [RestockService, InventoryRedisRepository, SalesRedisRepository],
  exports: [RestockService]
})
export class RestockModule { }
