import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QuizService } from '../servicies/quiz.service';
import { UnitOfWorkModule } from './unit-of-work.module';
import { QuizQuestionRepository } from '../repositories/quiz-question.repository';
import { AIModule } from './ai.module';
import { AdminInstructionModule } from './admin-instruction.module';
import { UserLogModule } from './user-log.module';
import { QueueName } from 'src/application/constant/processor';

@Module({
  imports: [
    UnitOfWorkModule,
    AIModule,
    AdminInstructionModule,
    UserLogModule,
    BullModule.registerQueue({ name: QueueName.QUIZ_QUEUE })
  ],
  providers: [QuizService, QuizQuestionRepository],
  exports: [QuizService]
})
export class QuizModule {}
