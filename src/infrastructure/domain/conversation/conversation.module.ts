import { Module, forwardRef } from '@nestjs/common';
import { ConversationService } from 'src/infrastructure/domain/conversation/conversation.service';
import { ConversationV9Service } from 'src/infrastructure/domain/conversation/conversation-v9.service';
import { AIModule } from 'src/infrastructure/domain/ai/ai.module';
import { UserLogModule } from 'src/infrastructure/domain/user-log/user-log.module';
import { ProductModule } from 'src/infrastructure/domain/product/product.module';
import { AdminInstructionModule } from 'src/infrastructure/domain/admin-instruction/admin-instruction.module';
import { UnitOfWorkModule } from 'src/infrastructure/domain/common/unit-of-work.module';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from 'src/application/constant/processor';
import { RecommendationModule } from 'src/infrastructure/domain/recommendation/recommendation.module';
import { DictionaryModule } from 'src/infrastructure/domain/common/dictionary.module';

@Module({
    imports: [
        UnitOfWorkModule,
        AIModule,
        UserLogModule,
        ProductModule,
        AdminInstructionModule,
        DictionaryModule,
        forwardRef(() => RecommendationModule), // Avoid circular dependency if any
        BullModule.registerQueue({ name: QueueName.CONVERSATION_QUEUE }),
    ],
    providers: [ConversationService, ConversationV9Service],
    exports: [ConversationService, ConversationV9Service],
})
export class ConversationModule { }
