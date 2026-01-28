import { Body, Controller, Inject, Post, Query } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { UIMessage } from 'ai';
import { Public } from 'src/application/common/Metadata';
import { AddQuesAnwsRequest } from 'src/application/dtos/request/add-ques-ans.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { MOBILE_CHAT_SERVICE } from 'src/infrastructure/modules/mobile-ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { QuizService } from 'src/infrastructure/servicies/quiz.service';
import { quizPrompt } from 'src/infrastructure/utils/convert-to-prompt';
import { UIMessageSchemaObject } from 'src/infrastructure/utils/schema-object';

@Controller('ai/mobile')
export class MobileAIController {
  constructor(
    @Inject(MOBILE_CHAT_SERVICE) private aiService: AIService,
    private quizService: QuizService
  ) {}

  @Public()
  @Post('chat/test')
  @ApiBody({
    schema: UIMessageSchemaObject
  })
  async chat(@Body() messages: UIMessage[]) {
    return this.aiService.TextGenerateFromMessages(messages);
  }

  @Public()
  @Post('search/test')
  async searchProductWithAI(
    @Query('prompt') prompt: string
  ): Promise<BaseResponse<string>> {
    return await this.aiService.TextGenerateFromPrompt(prompt);
  }

  @Public()
  @Post('user/quiz/test')
  @ApiBody({ type: [AddQuesAnwsRequest] })
  async chatQuiz(@Body() addQuesAnwsRequests: AddQuesAnwsRequest[]) {
    const quesAnses: Array<{ question: string; answer: string }> = [];
    await Promise.all(
      addQuesAnwsRequests.map(async (quesAns) => {
        const quest = await this.quizService.getQuizQuesById(
          quesAns.questionId
        );
        if (quest.success && quest.data) {
          const ans = quest.data.answers.find((a) => a.id === quesAns.answerId);
          quesAnses.push({
            question: quest.data.question,
            answer: ans?.answer || ''
          });
        } else {
          return { success: false, error: 'Quiz question not found' };
        }
      })
    );

    const prompt = quizPrompt(quesAnses);

    const aiResponse = await this.aiService.TextGenerateFromPrompt(prompt);

    if (!aiResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    return { success: true, data: aiResponse.data };
  }
}
