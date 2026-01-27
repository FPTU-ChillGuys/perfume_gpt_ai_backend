import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/application/common/Metadata';
import { ConversationService } from 'src/infrastructure/servicies/conversation.service';

@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Public()
  @Get()
  async getAllConversations() {
    return this.conversationService.getAllConversations();
  }
}
