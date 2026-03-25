import { SurveyAnswer } from 'src/domain/entities/survey-answer.entity';
import { SurveyAnswerResponse } from '../../dtos/response/survey-answer.response';
import { SurveyAnswerRequest } from 'src/application/dtos/request/survey-answer.request';
import { SurveyQuestion } from 'src/domain/entities/survey-question.entity';

export class SurveyAnswerMapper {
  static toResponse(entity: SurveyAnswer): SurveyAnswerResponse {
    return new SurveyAnswerResponse({
      id: entity.id,
      questionId: entity.question?.id,
      answer: entity.answer,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });
  }

  static toResponseList(entities: SurveyAnswer[]): SurveyAnswerResponse[] {
    return entities.map((entity) => this.toResponse(entity));
  }

  static toEntity(request: SurveyAnswerRequest, question?: SurveyQuestion): SurveyAnswer {
    const surveyAnswer = new SurveyAnswer({
      answer: request.answer
    });

    // Set question if provided
    if (question) {
      surveyAnswer.question = question;
    }

    return surveyAnswer;
  }

  static toEntityList(requests: SurveyAnswerRequest[], question?: SurveyQuestion): SurveyAnswer[] {
    return requests.map((request) => this.toEntity(request, question));
  }

  static updateEntity(entity: SurveyAnswer, request: SurveyAnswerRequest): SurveyAnswer {
    if (request.answer) {
      entity.answer = request.answer;
    }

    return entity;
  }
}

