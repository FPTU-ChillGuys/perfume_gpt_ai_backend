import { SurveyQuestion } from 'src/domain/entities/survey-question.entity';
import { SurveyQuestionResponse } from '../../dtos/response/survey-question.response';
import { SurveyAnswerMapper } from './survey-answer.mapper';
import { SurveyQuestionRequest } from 'src/application/dtos/request/survey-question.request';

export class SurveyQuestionMapper {
  static toResponse(entity: SurveyQuestion, includeAnswers: boolean = false): SurveyQuestionResponse {
    const response = new SurveyQuestionResponse({
      id: entity.id,
      questionType: entity.questionType,
      question: entity.question,
      order: entity.order,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });

    if (includeAnswers && entity.answers.isInitialized()) {
      response.answers = SurveyAnswerMapper.toResponseList(entity.answers.getItems());
    }

    return response;
  }

  static toResponseList(entities: SurveyQuestion[], includeAnswers: boolean = false): SurveyQuestionResponse[] {
    return entities.map((entity) => this.toResponse(entity, includeAnswers));
  }

  static toEntity(request: SurveyQuestionRequest): SurveyQuestion {
    const surveyQuestion = new SurveyQuestion({
      question: request.question,
      ...(request.questionType && { questionType: request.questionType }),
      ...(request.order !== undefined && { order: request.order })
    });

    // Map answers if provided
    if (request.answers && request.answers.length > 0) {
      const answers = request.answers.map(answerRequest =>
        SurveyAnswerMapper.toEntity(answerRequest, surveyQuestion)
      );
      surveyQuestion.answers.set(answers);
    }

    return surveyQuestion;
  }

  static toEntityList(requests: SurveyQuestionRequest[]): SurveyQuestion[] {
    return requests.map((request) => this.toEntity(request));
  }

  static updateEntity(entity: SurveyQuestion, request: SurveyQuestionRequest): SurveyQuestion {
    if (request.questionType !== undefined) {
      entity.questionType = request.questionType;
    }

    if (request.question) {
      entity.question = request.question;
    }

    if (request.order !== undefined) {
      entity.order = request.order;
    }

    if (request.answers) {
      const answers = request.answers.map(answerRequest =>
        SurveyAnswerMapper.toEntity(answerRequest, entity)
      );
      entity.answers.set(answers);
    }

    return entity;
  }
}
