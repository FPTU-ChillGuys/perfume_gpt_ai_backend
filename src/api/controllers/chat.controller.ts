import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { Output, UIMessage } from 'ai';
import { Public } from 'src/application/common/Metadata';
import { ConversationDto, ConversationRequestDto } from 'src/application/dtos/common/conversation.dto';
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

  @Public()
  @Get()
  @ApiBaseResponse(ConversationDto)
  async getAllConversations(): Promise<BaseResponse<ConversationDto[]>> {
    return await this.conversationService.getAllConversations();
  }

  //Natural language chat
  @Public()
  @Post()
  @ApiBaseResponse(ConversationDto)
  async chat(
    @Body() conversation: ConversationRequestDto
  ): Promise<BaseResponse<ConversationDto>> {
    const convertedMessages: UIMessage[] = convertToMessages(
      conversation.messages || []
    );

    // Call AI service to get response
    const message = await this.aiService.TextGenerateFromMessages(
      convertedMessages,
      Output.object(searchOutput)
    );

    if (!message.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    // Prepare response conversation
    const responseConversation = overrideMessagesToConversation(
      conversation.id || '',
      addMessageToMessages(message.data || '', conversation.messages || [])
    );

    // Save or update conversation in database
    if (
      !(await this.conversationService.isExistConversation(
        responseConversation.id || ''
      ))
    ) {
      await this.conversationService.addConversation(responseConversation);
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
