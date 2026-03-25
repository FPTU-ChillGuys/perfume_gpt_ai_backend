import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { SurveyAnswer } from 'src/domain/entities/survey-answer.entity';
import { SurveyQuestionAnswer } from 'src/domain/entities/survey-question-answer.entity';
import { SurveyQuestion } from 'src/domain/entities/survey-question.entity';

@Injectable()
export class SurveyQuestionAnswerRepository extends SqlEntityRepository<SurveyQuestionAnswer> {
  async createQuesAns(
    surveyQuestionAnswer: SurveyQuestionAnswer,
  ): Promise<SurveyQuestionAnswer> {
    const orm = this.getEntityManager();
    orm.persist(surveyQuestionAnswer);
    await orm.flush();
    return surveyQuestionAnswer;
  }
}
