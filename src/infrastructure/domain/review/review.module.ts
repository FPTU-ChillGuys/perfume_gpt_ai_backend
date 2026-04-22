import { Module } from "@nestjs/common";
import { ReviewService } from 'src/infrastructure/domain/review/review.service';
import { UnitOfWorkModule } from 'src/infrastructure/domain/common/unit-of-work.module';
import { RedisModule } from '../common/redis/redis.module';
import { ReviewTool } from 'src/chatbot/tools/review.tool';
import { ReviewRedisRepository } from '../repositories/redis/review-redis.repository';

@Module({
  imports: [UnitOfWorkModule, RedisModule],
  providers: [ReviewService, ReviewTool, ReviewRedisRepository],
  exports: [ReviewService, ReviewTool, ReviewRedisRepository]
})
export class ReviewModule { }
