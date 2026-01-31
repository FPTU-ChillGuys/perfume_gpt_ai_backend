import { Body, Controller, Inject, Post, Query } from '@nestjs/common';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { Output, UIMessage } from 'ai';
import { Public } from 'src/application/common/Metadata';
import { ConversationDto } from 'src/application/dtos/common/conversation.dto';
import { AddQuesAnwsRequest } from 'src/application/dtos/request/add-ques-ans.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { searchOutput } from 'src/chatbot/utils/output/search.output';
import { QUIZ_SYSTEM_PROMPT } from 'src/chatbot/utils/prompts';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { ConversationService } from 'src/infrastructure/servicies/conversation.service';
import { QuizService } from 'src/infrastructure/servicies/quiz.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { quizPrompt } from 'src/infrastructure/utils/convert-to-prompt';
import {
  addMessageToMessages,
  convertToMessages,
  overrideMessagesToConversation
} from 'src/infrastructure/utils/message-helper';

@Controller('ai')
export class AIController {
  constructor(
    @Inject(AI_SERVICE) private aiService: AIService,
    private quizService: QuizService,
    private conversattionService: ConversationService
  ) {}

  @Public()
  @Post('search')
  @ApiBaseResponse(String)
  async searchProductWithAI(
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    const aiResponse = await this.aiService.TextGenerateFromPrompt(prompt);
    if (!aiResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }
    return { success: true, data: aiResponse.data };
  }
  
}
