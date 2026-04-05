import { SurveyQuestionAnswer } from 'src/domain/entities/survey-question-answer.entity';
import { SurveyQuestionAnswerDetailMapper } from './survey-question-answer-detail.mapper';
import { SurveyQuestion } from 'src/domain/entities/survey-question.entity';
import { SurveyAnswer } from 'src/domain/entities/survey-answer.entity';
import { SurveyQuestionAnswerResponse } from 'src/application/dtos/response/survey-question-answer.response';

export class SurveyQuestionAnswerMapper {
  static toResponse(
    entity: SurveyQuestionAnswer,
    includeDetails: boolean = false
  ): SurveyQuestionAnswerResponse {
    const response = new SurveyQuestionAnswerResponse({
      id: entity.id,
      userId: entity.userId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });

    if (includeDetails && entity.details.isInitialized()) {
      response.details = SurveyQuestionAnswerDetailMapper.toResponseList(
        entity.details.getItems()
      );
    } else {
      response.details = [];
    }

    return response;
  }

  static toResponseList(
    entities: SurveyQuestionAnswer[],
    includeDetails: boolean = false
  ): SurveyQuestionAnswerResponse[] {
    return entities.map((entity) => this.toResponse(entity, includeDetails));
  }

  static toEntity({
      userId,
      details
  }: {
      userId: string;
      details: { question: SurveyQuestion; answer: SurveyAnswer }[];
  }): SurveyQuestionAnswer {
    const quesAns = new SurveyQuestionAnswer({
      userId: userId
    });

    quesAns.details.set(
      SurveyQuestionAnswerDetailMapper.toEntityList(
        details.map(item => ({
          question: item.question,
          answer: item.answer,
          surveyQuestionAnswer: quesAns
        }))
      )
    );

    return quesAns;
  }
}
