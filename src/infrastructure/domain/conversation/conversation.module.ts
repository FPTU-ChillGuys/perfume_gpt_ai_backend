import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from 'src/application/constant/processor';
import { ConversationService } from 'src/infrastructure/domain/conversation/conversation.service';
import { AIModule } from 'src/infrastructure/domain/ai/ai.module';
import { UserLogModule } from 'src/infrastructure/domain/user-log/user-log.module';
import { ProductModule } from 'src/infrastructure/domain/product/product.module';
import { AdminInstructionModule } from 'src/infrastructure/domain/admin-instruction/admin-instruction.module';
import { UnitOfWorkModule } from 'src/infrastructure/domain/common/unit-of-work.module';
import { RecommendationModule } from 'src/infrastructure/domain/recommendation/recommendation.module';
import { DictionaryModule } from 'src/infrastructure/domain/common/dictionary.module';
import { AIAcceptanceModule } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.module';
import { SurveyModule } from 'src/infrastructure/domain/survey/survey.module';
import { OrderModule } from 'src/infrastructure/domain/order/order.module';
import { ProfileModule } from 'src/infrastructure/domain/profile/profile.module';
import { CartModule } from 'src/infrastructure/domain/cart/cart.module';
import { UserModule } from 'src/infrastructure/domain/user/user.module';
import { AIAnalysisHelper } from './helpers/ai-analysis.helper';
import { AIPersonalizationHelper } from './helpers/ai-personalization.helper';
import { AISearchExecutorHelper } from './helpers/ai-search-executor.helper';
import { ConversationInputHelper } from './helpers/conversation-input.helper';
import { ConversationResponseBuilder } from './helpers/conversation-response.builder';
import { NlpQueryMapper } from './helpers/nlp-query-mapper.helper';
@Module({
  imports: [
    UnitOfWorkModule,
    AIModule,
    UserLogModule,
    ProductModule,
    CartModule,
    SurveyModule,
    OrderModule,
    ProfileModule,
    AIAcceptanceModule,
    AdminInstructionModule,
    DictionaryModule,
    UserModule,
    forwardRef(() => RecommendationModule),
    BullModule.registerQueue({ name: QueueName.CONVERSATION_IMPROVER_QUEUE })
  ],
  providers: [
    ConversationService,
    AIAnalysisHelper,
    AIPersonalizationHelper,
    AISearchExecutorHelper,
    ConversationInputHelper,
    ConversationResponseBuilder,
    NlpQueryMapper
  ],
  exports: [
    ConversationService,
    AIAnalysisHelper,
    AIPersonalizationHelper,
    AISearchExecutorHelper,
    ConversationInputHelper,
    NlpQueryMapper
  ]
})
export class ConversationModule {}
