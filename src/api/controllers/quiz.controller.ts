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
import { QuizAnswerRequest } from 'src/application/dtos/request/quiz-answer.request';
import { QuizQuesAnwsRequest } from 'src/application/dtos/request/quiz-ques-ans.request';
import { QuizQuestionRequest } from 'src/application/dtos/request/quiz-question.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { QuizQuestionResponse } from 'src/application/dtos/response/quiz-question.response';
import { QuizQuestionAnswerMapper, QuizQuestionMapper } from 'src/application/mapping';
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

  // Lay tat ca cau hoi quiz
  @Public()
  @Get("questions")
  @ApiBaseResponse(QuizQuestion)
  async getAllQuizzes() : Promise<BaseResponse<QuizQuestionResponse[]>> {
    const quizQues = await this.quizService.getAllQuizQues();
    
    if (!quizQues.success) {
      return { success: false, error: 'Failed to get quiz questions' };
    }

    return { success: true, data: quizQues.data };
  }

  // Tao cau hoi quiz
  @Public()
  @Post("questions")
  async createQuizQues(@Body() quizQuestionRequest: QuizQuestionRequest) {
    return this.quizService.addQuizQues(quizQuestionRequest);
  }

  // Tao nhieu cau hoi quiz
  @Public()
  @Post('questions/list')
  @ApiBody({ type: [QuizQuestionRequest] })
  async createQuizQueses(@Body() quizQuestionRequest: QuizQuestionRequest[]) {
    for (const quizQuestion of quizQuestionRequest) {
      await this.quizService.addQuizQues(quizQuestion);
    }
    return { success: true };
  }

  // Cap nhat cau tra loi quiz
  @Public()
  @Put('questions/:id')
  @ApiBody({ type: [QuizAnswerRequest] })
  async updateQuizAnswer(
    @Param('id') id: string,
    @Body() quizAnswerRequest: QuizAnswerRequest[]
  ) : Promise<BaseResponse<QuizQuestionResponse>> {
    return this.quizService.updateAnswer(id, quizAnswerRequest);
  }

  //5-question interactive quiz
  @Public()
  @Post('user')
  @ApiBaseResponse(String)
  @ApiBody({ schema: { example: [{ questionId: 'string', answerId: 'string' }] } })
  async chatQuiz(
    @Body() quizAnswers: { questionId: string; answerId: string }[]
  ): Promise<BaseResponse<string>> {

    // Lay cau hoi quiz va cau tra loi tuong ung
    const questionIds = quizAnswers.map(qa => qa.questionId);
    const quizQueses = await this.quizService.getQuizQuesByIdList(questionIds);
    if (!quizQueses.success) {
      return { success: false, error: 'Failed to get quiz question' };
    }

    // Tim cau tra loi trong cau hoi
    const quesAnses: Array<{ question: string; answer: string }> = [];
    if (quizQueses.data) {
      for (let i = 0; i < quizQueses.data.length; i++) {
        const quizQues = quizQueses.data[i];
        if (quizQues.answers && quizQues.question) {
          const answer = quizQues.answers.find(ans => ans.id === quizAnswers[i].answerId);
          if (answer && answer.answer) {
            quesAnses.push({ question: quizQues.question, answer: answer.answer });
          }
        }
      }
    }

    // Generate prompt
    const prompt = quizPrompt(quesAnses);

    // Get AI response
    const aiResponse = await this.aiService.textGenerateFromPrompt(
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
