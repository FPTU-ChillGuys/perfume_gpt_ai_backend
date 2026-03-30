import { Module } from '@nestjs/common';
import { ProductController } from 'src/api/controllers/product.controller';
import { SurveyController } from 'src/api/controllers/survey.controller';
import { AIController } from 'src/api/controllers/ai/ai.controller';
import { LogController } from 'src/api/controllers/log.controller';
import { ConversationController } from 'src/api/controllers/conversation.controller';
import { TrendController } from 'src/api/controllers/trend.controller';
import { ReviewController } from 'src/api/controllers/review.controller';
import { RecommendationController } from 'src/api/controllers/recommendation.controller';
import { InventoryController } from 'src/api/controllers/inventory.controller';
import { AIAcceptanceController } from 'src/api/controllers/ai-acceptance.controller';
import { AdminInstructionController } from 'src/api/controllers/admin-instruction.controller';
import { OrderController } from 'src/api/controllers/order.controller';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from 'src/application/constant/processor';
import { ProcessorModule } from 'src/infrastructure/domain/common/processor.module';
import { modules } from './list/module';
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheableMemory, Keyv } from 'cacheable';
import KeyvRedis from '@keyv/redis';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheableModule } from './cacheable/cacheable.module';

const registerQueue = BullModule.registerQueue(
  ...Object.values(QueueName).map((value) => ({ name: value }))
);

@Module({
  imports: [...modules, registerQueue, ProcessorModule, CacheModule.registerAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: async (config: ConfigService) => {
      const redisUrl = `redis://${config.get<string>('REDIS_HOST') ?? 'localhost'}:${config.get<number>('REDIS_PORT') ?? 6379}`;
      return {
        ttl: config.get<number>('CACHE_TTL') ?? 60000,
        lruSize: config.get<number>('CACHE_LRU_SIZE') ?? 5000,
        stores: [
          new Keyv({
            store: new KeyvRedis(redisUrl),
          }),
        ],
      };
    },
  }),],
  controllers: [
    ProductController,
    SurveyController,
    AIController,
    LogController,
    ConversationController,
    TrendController,
    ReviewController,
    RecommendationController,
    InventoryController,
    AIAcceptanceController,
    AdminInstructionController,
    OrderController,
  ],
  // providers: [
  //   {
  //     provide: APP_INTERCEPTOR,
  //     useClass: CacheInterceptor
  //   },
  //   CacheableModule
  // ],
  exports: modules
})
export class ProviderModule { }
