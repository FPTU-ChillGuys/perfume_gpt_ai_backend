import { Module } from '@nestjs/common';
import { RecommendationService } from '../servicies/recommandation.service';
import { AIModule } from './ai.module';
import { AdminInstructionModule } from './admin-instruction.module';
import { UserModule } from './user.module';
import { EmailModule } from './email.module';

@Module({
  imports: [AIModule, AdminInstructionModule, UserModule, EmailModule],
  providers: [RecommendationService],
  exports: [RecommendationService]
})
export class RecommendationModule {}
