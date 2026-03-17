import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConversationService } from '../servicies/conversation.service';
import { UnitOfWorkModule } from './unit-of-work.module';
import { AIModule } from './ai.module';
import { AdminInstructionModule } from './admin-instruction.module';
import { QueueName } from 'src/application/constant/processor';
import { UserLogModule } from './user-log.module';

@Module({
  imports: [
    UnitOfWorkModule,
    AIModule,
    AdminInstructionModule,
    UserLogModule,
    BullModule.registerQueue({ name: QueueName.CONVERSATION_QUEUE })
  ],
  providers: [ConversationService],
  exports: [ConversationService]
})
export class ConversationModule {}
