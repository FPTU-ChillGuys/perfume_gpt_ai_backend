import { Module } from '@nestjs/common';
import { QuizService } from '../servicies/quiz.service';
import { UnitOfWorkModule } from './unit-of-work.module';
import { QuizQuestionRepository } from '../repositories/quiz-question.repository';

@Module({
  imports: [UnitOfWorkModule],
  providers: [QuizService, QuizQuestionRepository],
  exports: [QuizService]
})
export class QuizModule {}
