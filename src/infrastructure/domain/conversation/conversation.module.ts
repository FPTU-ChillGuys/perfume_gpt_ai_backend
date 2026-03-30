import { Module } from '@nestjs/common';
import { ConversationService } from 'src/infrastructure/domain/conversation/conversation.service';
import { AIModule } from 'src/infrastructure/domain/ai/ai.module';
import { UserLogModule } from 'src/infrastructure/domain/user-log/user-log.module';
import { ProductModule } from 'src/infrastructure/domain/product/product.module';
import { AdminInstructionModule } from 'src/infrastructure/domain/admin-instruction/admin-instruction.module';
import { UnitOfWorkModule } from 'src/infrastructure/domain/common/unit-of-work.module';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from 'src/application/constant/processor';

@Module({
    imports: [
        UnitOfWorkModule,
        AIModule,
        UserLogModule,
        ProductModule,
        AdminInstructionModule,
        BullModule.registerQueue({ name: QueueName.CONVERSATION_QUEUE }),
    ],
    providers: [ConversationService],
    exports: [ConversationService],
})
export class ConversationModule { }
