import { Module } from '@nestjs/common';
import { QuizService } from '../servicies/quiz.service';
import { UnitOfWorkModule } from './unit-of-work.module';

@Module({
  imports: [UnitOfWorkModule],
  providers: [QuizService],
  exports: [QuizService]
})
export class QuizModule {}
