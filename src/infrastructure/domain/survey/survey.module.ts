import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SurveyService } from 'src/infrastructure/domain/survey/survey.service';
import { UnitOfWorkModule } from 'src/infrastructure/domain/common/unit-of-work.module';
import { SurveyQuestionRepository } from 'src/infrastructure/domain/repositories/survey-question.repository';
import { AIModule } from 'src/infrastructure/domain/ai/ai.module';
import { AdminInstructionModule } from 'src/infrastructure/domain/admin-instruction/admin-instruction.module';
import { UserLogModule } from 'src/infrastructure/domain/user-log/user-log.module';
import { QueueName } from 'src/application/constant/processor';

import { ProductModule } from 'src/infrastructure/domain/product/product.module';
import { AIAcceptanceModule } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.module';
import { SurveyAttributeService } from 'src/infrastructure/domain/survey/survey-attribute.service';
import { SurveyQueryValidatorService } from 'src/infrastructure/domain/survey/survey-query-validator.service';
import { SurveyInputHelper } from 'src/infrastructure/domain/survey/helpers/survey-input.helper';
import { SurveyProductHelper } from 'src/infrastructure/domain/survey/helpers/survey-product.helper';
import { SurveyPipelineHelper } from 'src/infrastructure/domain/survey/helpers/survey-pipeline.helper';
@Module({
  imports: [
    UnitOfWorkModule,
    AIModule,
    AdminInstructionModule,
    UserLogModule,
    ProductModule,
    AIAcceptanceModule,
    BullModule.registerQueue({ name: QueueName.SURVEY_QUEUE })
  ],
  providers: [
    SurveyService,
    SurveyQuestionRepository,
    SurveyAttributeService,
    SurveyQueryValidatorService,
    SurveyInputHelper,
    SurveyProductHelper,
    SurveyPipelineHelper
  ],
  exports: [
    SurveyService,
    SurveyAttributeService,
    SurveyQueryValidatorService,
    SurveyInputHelper
  ]
})
export class SurveyModule {}
