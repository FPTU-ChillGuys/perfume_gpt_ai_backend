import { Module } from "@nestjs/common";
import { ReviewService } from 'src/infrastructure/domain/review/review.service';
import { UnitOfWorkModule } from 'src/infrastructure/domain/common/unit-of-work.module';
import { NatsModule } from '../common/nats/nats.module';
import { ReviewTool } from 'src/chatbot/tools/review.tool';
import { ReviewNatsRepository } from '../repositories/nats/review-nats.repository';

@Module({
  imports: [UnitOfWorkModule, NatsModule],
  providers: [ReviewService, ReviewTool, ReviewNatsRepository],
  exports: [ReviewService, ReviewTool, ReviewNatsRepository]
})
export class ReviewModule { }
