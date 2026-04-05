import { SurveyQuestionAnswerDetail } from 'src/domain/entities/survey-question-answer-detail.entity';
import { SurveyQuestionAnswerDetailResponse } from '../../dtos/response/survey-question-answer-detail.response';
import { SurveyQuestion } from 'src/domain/entities/survey-question.entity';
import { SurveyAnswer } from 'src/domain/entities/survey-answer.entity';
import { SurveyQuestionAnswer } from 'src/domain/entities/survey-question-answer.entity';

export class SurveyQuestionAnswerDetailMapper {
  static toResponse(
    entity: SurveyQuestionAnswerDetail
  ): SurveyQuestionAnswerDetailResponse {
    const response = new SurveyQuestionAnswerDetailResponse();

    response.id = entity.id;
    response.questionId = entity.question?.id || '';
    response.question = entity.question?.question || '';
    response.answerId = entity.answer?.id || '';
    response.answer = entity.answer?.answer || '';
    response.createdAt = entity.createdAt;
    response.updatedAt = entity.updatedAt;

    return response;
  }

  static toResponseList(
    entities: SurveyQuestionAnswerDetail[]
  ): SurveyQuestionAnswerDetailResponse[] {
    return entities.map((entity) => this.toResponse(entity));
  }

  static toEntity(
    question: SurveyQuestion,
    answer: SurveyAnswer,
    surveyQuestionAnswer: SurveyQuestionAnswer
  ): SurveyQuestionAnswerDetail {
    const detail = new SurveyQuestionAnswerDetail();

    detail.question = question;
    detail.answer = answer;
    detail.quesAns = surveyQuestionAnswer;

    return detail;
  }

  static toEntityList(
    items: {
      question: SurveyQuestion;
      answer: SurveyAnswer;
      surveyQuestionAnswer: SurveyQuestionAnswer;
    }[]
  ): SurveyQuestionAnswerDetail[] {
    return items.map((item) =>
      this.toEntity(item.question, item.answer, item.surveyQuestionAnswer)
    );
  }
}
