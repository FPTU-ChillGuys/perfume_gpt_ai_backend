import { Module } from '@nestjs/common';
import { ConversationService } from '../servicies/conversation.service';

@Module({
  providers: [ConversationService],
  exports: [ConversationService]
})
export class ConversationModule {}
