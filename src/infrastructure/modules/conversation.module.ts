import { Module } from '@nestjs/common';
import { ConversationService } from '../servicies/conversation.service';
import { UnitOfWorkModule } from './unit-of-work.module';

@Module({
  imports: [UnitOfWorkModule],
  providers: [ConversationService],
  exports: [ConversationService]
})
export class ConversationModule {}
