import { Body, Controller, Inject, Post } from '@nestjs/common';
import { Output, UIMessage } from 'ai';
import { Public } from 'src/application/common/Metadata';
import { ConversationDto } from 'src/application/dtos/common/conversation.dto';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { searchOutput } from 'src/chatbot/utils/output/search.output';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { ConversationService } from 'src/infrastructure/servicies/conversation.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import {
  addMessageToMessages,
  convertToMessages,
  overrideMessagesToConversation
} from 'src/infrastructure/utils/message-helper';

@Controller('chat')
export class ChatController {
  constructor(
    @Inject(AI_SERVICE) private aiService: AIService,
    private conversationService: ConversationService
  ) {}

  //Natural language chat
  @Public()
  @Post()
  @ApiBaseResponse(ConversationDto)
  async chat(
    @Body() conversation: ConversationDto
  ): Promise<BaseResponse<ConversationDto>> {
    const convertedMessages: UIMessage[] = convertToMessages(
      conversation.messages || []
    );
    const message = await this.aiService.TextGenerateFromMessages(
      convertedMessages,
      Output.object(searchOutput)
    );

    if (!message.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    const responseConversation = overrideMessagesToConversation(
      conversation.id,
      addMessageToMessages(message.data || '', conversation.messages || [])
    );

    if (
      !(await this.conversationService.isExistConversation(
        responseConversation.id
      ))
    ) {
      const conversation = await this.conversationService.addConversation(responseConversation);
      
    } else {
      await this.conversationService.updateMessageToConversation(
        responseConversation.id!,
        responseConversation.messages || []
      );
    }

    return {
      success: true,
      data: responseConversation
    };
  }
}
