import { Module } from '@nestjs/common';
import { SourcingCatalogService } from './sourcing-catalog.service';
import { RedisModule } from '../common/redis/redis.module';
import { SourcingController } from 'src/api/controllers/sourcing.controller';

@Module({
  imports: [RedisModule],
  controllers: [SourcingController],
  providers: [SourcingCatalogService],
  exports: [SourcingCatalogService],
})
export class SourcingModule {}
