import { Module } from '@nestjs/common';
import { RedisSubscriberService } from './redis-subscriber.service';
import { RecommendationModule } from 'src/infrastructure/domain/recommendation/recommendation.module';

@Module({
  imports: [RecommendationModule],
  providers: [RedisSubscriberService]
})
export class RedisModule {}
