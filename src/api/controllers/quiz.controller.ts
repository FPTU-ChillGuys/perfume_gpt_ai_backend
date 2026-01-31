import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { AddQuesAnwsRequest } from 'src/application/dtos/request/add-ques-ans.request';
import { QuizAnswerRequest } from 'src/application/dtos/request/add-quiz-answer.request';
import { QuizQuestionRequest } from 'src/application/dtos/request/add-quiz-question.request';
import { QuizQuestionResponse } from 'src/application/dtos/response/quiz-question.response';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { QuizService } from 'src/infrastructure/servicies/quiz.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';

@Controller('quizzes')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

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
  @Post('user/quiz')
  async addUserAnswer(@Body() quizQuesAnws: AddQuesAnwsRequest) {
    return this.quizService.addQuizQuesAnws(quizQuesAnws);
  }

  //5-question interactive quiz
}
