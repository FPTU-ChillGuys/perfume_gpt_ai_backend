import { Module } from '@nestjs/common';
import { RecommendationService } from 'src/infrastructure/domain/recommendation/recommandation.service';
import { RecommendationV2Service } from 'src/infrastructure/domain/recommendation/recommendation-v2.service';
import { RecommendationV3Service } from 'src/infrastructure/domain/recommendation/recommendation-v3.service';
import { AIModule } from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionModule } from 'src/infrastructure/domain/admin-instruction/admin-instruction.module';
import { UserModule } from 'src/infrastructure/domain/user/user.module';
import { EmailModule } from 'src/infrastructure/domain/common/email.module';
import { OrderModule } from 'src/infrastructure/domain/order/order.module';
import { ProductModule } from 'src/infrastructure/domain/product/product.module';
import { UserLogModule } from 'src/infrastructure/domain/user-log/user-log.module';
import { AIAcceptanceModule } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.module';

@Module({
  imports: [AIModule, AdminInstructionModule, UserModule, EmailModule, OrderModule, ProductModule, UserLogModule, AIAcceptanceModule],
  providers: [RecommendationService, RecommendationV2Service, RecommendationV3Service],
  exports: [RecommendationService, RecommendationV2Service, RecommendationV3Service]
})
export class RecommendationModule {}
