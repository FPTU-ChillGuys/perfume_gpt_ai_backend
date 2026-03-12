import { Module } from '@nestjs/common';
import { ReviewAIService } from '../servicies/review-ai.service';
import { ReviewModule } from './review.module';
import { AdminInstructionModule } from './admin-instruction.module';
import { AIModule } from './ai.module';

@Module({
  imports: [ReviewModule, AdminInstructionModule, AIModule],
  providers: [ReviewAIService],
  exports: [ReviewAIService]
})
export class ReviewAIModule {}
