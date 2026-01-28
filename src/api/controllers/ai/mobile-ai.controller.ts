import { Body, Controller, Inject, Post, Query } from '@nestjs/common';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { UIMessage } from 'ai';
import { Public } from 'src/application/common/Metadata';
import { ConversationDto } from 'src/application/dtos/common/conversation.dto';
import { AddQuesAnwsRequest } from 'src/application/dtos/request/add-ques-ans.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { ConversationService } from 'src/infrastructure/servicies/conversation.service';
import { QuizService } from 'src/infrastructure/servicies/quiz.service';
import { quizPrompt } from 'src/infrastructure/utils/convert-to-prompt';
import {
  addMessageToMessages,
  convertToMessages,
  overrideMessagesToConversation
} from 'src/infrastructure/utils/message-helper';
import { UIMessageSchemaObject } from 'src/infrastructure/utils/schema-object';

@Controller('ai/mobile')
export class MobileAIController {
 
}
