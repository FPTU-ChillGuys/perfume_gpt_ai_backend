import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put
} from '@nestjs/common';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { AddQuesAnwsRequest } from 'src/application/dtos/request/ques-ans.request';
import { QuizAnswerRequest } from 'src/application/dtos/request/quiz-answer.request';
import { QuizQuestionRequest } from 'src/application/dtos/request/quiz-question.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { QuizQuestionResponse } from 'src/application/dtos/response/quiz-question.response';
import { QUIZ_SYSTEM_PROMPT } from 'src/chatbot/utils/prompts';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { QuizService } from 'src/infrastructure/servicies/quiz.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { quizPrompt } from 'src/infrastructure/utils/convert-to-prompt';

@Controller('quizzes')
export class QuizController {
  constructor(
    @Inject(AI_SERVICE) private aiService: AIService,
    private quizService: QuizService
  ) {}

  @Public()
  @Get()
  @ApiBaseResponse(QuizQuestion)
  async getAllQuizzes() {
    return this.quizService.getAllQuizQues();
  }

  @Public()
  @Post()
  async createQuizQues(@Body() quizQuestionRequest: QuizQuestionRequest) {
    return this.quizService.addQuesAnws(quizQuestionRequest);
  }

  @Public()
  @Post('list')
  @ApiBody({ type: [QuizQuestionRequest] })
  async createQuizQueses(@Body() quizQuestionRequest: QuizQuestionRequest[]) {
    for (const quizQuestion of quizQuestionRequest) {
      await this.quizService.addQuesAnws(quizQuestion);
    }
    return { success: true };
  }

  @Public()
  @Put(':id')
  @ApiBody({ type: [QuizAnswerRequest] })
  async updateQuizAnswer(
    @Param('id') id: string,
    @Body() quizAnswerRequest: QuizAnswerRequest[]
  ) {
    return this.quizService.updateAnswer(id, quizAnswerRequest);
  }

  @Public()
  @Post('user/test')
  async addUserAnswer(@Body() quizQuesAnws: AddQuesAnwsRequest) {
    return this.quizService.addQuizQuesAnws(quizQuesAnws);
  }

  //5-question interactive quiz
  @Public()
  @Post('user')
  @ApiBaseResponse(String)
  @ApiBody({ type: [AddQuesAnwsRequest] })
  async chatQuiz(
    @Body() addQuesAnwsRequests: AddQuesAnwsRequest[]
  ): Promise<BaseResponse<string>> {
    const quesAnses: Array<{ question: string; answer: string }> = [];
    await Promise.all(
      addQuesAnwsRequests.map(async (quesAns) => {
        const quest = await this.quizService.getQuizQuesById(
          quesAns.questionId
        );
        if (quest.success && quest.data) {
          const ans = quest.data.answers?.find(
            (a) => a.id === quesAns.answerId
          );
          quesAnses.push({
            question: quest.data.question || '',
            answer: ans?.answer || ''
          });
        } else {
          return { success: false, error: 'Quiz question not found' };
        }
      })
    );

    // Generate prompt
    const prompt = quizPrompt(quesAnses);

    // Get AI response
    const aiResponse = await this.aiService.TextGenerateFromPrompt(
      prompt,
      QUIZ_SYSTEM_PROMPT
    );

    // Return response
    if (!aiResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    return { success: true, data: aiResponse.data };
  }
}
