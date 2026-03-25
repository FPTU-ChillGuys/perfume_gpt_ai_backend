import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SurveyService } from '../servicies/survey.service';
import { UnitOfWorkModule } from './unit-of-work.module';
import { SurveyQuestionRepository } from '../repositories/survey-question.repository';
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
    BullModule.registerQueue({ name: QueueName.SURVEY_QUEUE })
  ],
  providers: [SurveyService, SurveyQuestionRepository],
  exports: [SurveyService]
})
export class SurveyModule {}
