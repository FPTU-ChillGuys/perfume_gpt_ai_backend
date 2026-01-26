import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/application/common/Metadata';
import { QuizService } from 'src/infrastructure/servicies/quiz.service';

@Controller('quizzes')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Public()
  @Get()
  async getAllQuizzes() {
    return this.quizService.getAllQuizQues();
  }
}
