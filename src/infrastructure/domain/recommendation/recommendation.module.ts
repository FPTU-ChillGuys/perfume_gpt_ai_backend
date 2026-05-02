import { Module } from '@nestjs/common';
import { RecommendationService } from 'src/infrastructure/domain/recommendation/recommandation.service';
import { AIModule } from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionModule } from 'src/infrastructure/domain/admin-instruction/admin-instruction.module';
import { UserModule } from 'src/infrastructure/domain/user/user.module';
import { EmailModule } from 'src/infrastructure/domain/common/email.module';
import { OrderModule } from 'src/infrastructure/domain/order/order.module';
import { ProductModule } from 'src/infrastructure/domain/product/product.module';
import { UserLogModule } from 'src/infrastructure/domain/user-log/user-log.module';
import { AIAcceptanceModule } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.module';
import { ProfileModule } from 'src/infrastructure/domain/profile/profile.module';

@Module({
  imports: [
    AIModule,
    AdminInstructionModule,
    UserModule,
    EmailModule,
    OrderModule,
    ProductModule,
    UserLogModule,
    AIAcceptanceModule,
    ProfileModule
  ],
  providers: [RecommendationService],
  exports: [RecommendationService]
})
export class RecommendationModule {}
