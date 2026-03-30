import { Module } from '@nestjs/common';
import { ReviewAIService } from 'src/infrastructure/domain/review/review-ai.service';
import { ReviewModule } from 'src/infrastructure/domain/review/review.module';
import { AdminInstructionModule } from 'src/infrastructure/domain/admin-instruction/admin-instruction.module';
import { AIModule } from 'src/infrastructure/domain/ai/ai.module';

@Module({
  imports: [ReviewModule, AdminInstructionModule, AIModule],
  providers: [ReviewAIService],
  exports: [ReviewAIService]
})
export class ReviewAIModule {}
