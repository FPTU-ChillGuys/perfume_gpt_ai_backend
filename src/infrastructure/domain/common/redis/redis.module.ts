import { Module } from '@nestjs/common';
import { RedisSubscriberService } from './redis-subscriber.service';
import { RedisRequestResponseService } from './redis-request-response.service';
import { RecommendationModule } from 'src/infrastructure/domain/recommendation/recommendation.module';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from 'src/application/constant/processor';

@Module({
  imports: [
    RecommendationModule,
    BullModule.registerQueue({ name: QueueName.REVIEW_QUEUE })
  ],
  providers: [RedisSubscriberService, RedisRequestResponseService],
  exports: [RedisRequestResponseService]
})
export class RedisModule {}
