import { Body, Controller, Get, Post } from '@nestjs/common';
import { Public } from 'src/application/common/Metadata';
import { QuizQuestionRequest } from 'src/application/dtos/request/add-quiz-question.request';
import { QuizService } from 'src/infrastructure/servicies/quiz.service';

@Controller('quizzes')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Public()
  @Get()
  async getAllQuizzes() {
    return this.quizService.getAllQuizQues();
  }

  @Public()
  @Post()
  async createQuizQues(@Body() quizQuestionRequest: QuizQuestionRequest) {
    return this.quizService.addQuesAnws(quizQuestionRequest);
  }
}
