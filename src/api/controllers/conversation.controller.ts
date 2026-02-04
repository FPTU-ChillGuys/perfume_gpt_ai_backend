import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { Output, UIMessage } from 'ai';
import { Public } from 'src/application/common/Metadata';
import { ConversationDto, ConversationRequestDto } from 'src/application/dtos/common/conversation.dto';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { searchOutput } from 'src/chatbot/utils/output/search.output';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { ConversationService } from 'src/infrastructure/servicies/conversation.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import {
  addMessageToMessages,
  convertToMessages,
  overrideMessagesToConversation
} from 'src/infrastructure/utils/message-helper';

@Controller('conversation')
export class ConversationController {
  constructor(
    @Inject(AI_SERVICE) private aiService: AIService,
    private conversationService: ConversationService,
    private logService: UserLogService
  ) {}

  @Public()
  @Get()
  @ApiBaseResponse(ConversationDto)
  async getAllConversations(): Promise<BaseResponse<ConversationDto[]>> {
    return await this.conversationService.getAllConversations();
  }

  @Public()
  @Get(':id')
  @ApiQuery({ name: 'id', type: String })
  async getConversationById(
    @Query('id') id: string
  ): Promise<BaseResponse<ConversationDto>> {
    return await this.conversationService.getConversationById(id);
  }

  //Natural language chat
  @Public()
  @Post()
  @ApiBaseResponse(ConversationRequestDto)
  async chat(
    @Body() conversation: ConversationRequestDto
  ) {
    const convertedMessages: UIMessage[] = convertToMessages(
      conversation.messages || []
    );

    // Lay log nguoi dung tu db trong khoan 1 thang 
    const userLog = await this.logService.collectAndSummarizeUserLogs({
      userId: conversation.userId || '',
      period: PeriodEnum.MONTHLY,
      endDate: new Date(),
    })
    

    // Call AI service to get response
    const message = await this.aiService.textGenerateFromMessages(
      convertedMessages,
      Output.object(searchOutput),
      userLog.data?.prompt
    );

    if (!message.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    // Prepare response conversation
    const responseConversation = overrideMessagesToConversation(
      conversation.id || '',
      conversation.userId || '',
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
