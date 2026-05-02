import { Module } from '@nestjs/common';
import { ReviewService } from 'src/infrastructure/domain/review/review.service';
import { UnitOfWorkModule } from 'src/infrastructure/domain/common/unit-of-work.module';
import { ReviewTool } from 'src/chatbot/tools/review.tool';
import { PrismaModule } from 'src/prisma/prisma.module';
@Module({
  imports: [UnitOfWorkModule, PrismaModule],
  providers: [ReviewService, ReviewTool],
  exports: [ReviewService, ReviewTool]
})
export class ReviewModule {}
