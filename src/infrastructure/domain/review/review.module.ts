import { Module } from "@nestjs/common";
import { ReviewService } from 'src/infrastructure/domain/review/review.service';
import { UnitOfWorkModule } from 'src/infrastructure/domain/common/unit-of-work.module';
import { ReviewTool } from 'src/chatbot/tools/review.tool';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ProviderModule } from 'src/infrastructure/domain/common/provider.module';

@Module({
  imports: [UnitOfWorkModule, PrismaModule, ProviderModule],
  providers: [ReviewService, ReviewTool],
  exports: [ReviewService, ReviewTool]
})
export class ReviewModule { }
