import { QuizQuestionAnswerDetail } from 'src/domain/entities/quiz-question-answer-detail.entity';
import { QuizQuestionAnswerDetailResponse } from '../../dtos/response/quiz-question-answer-detail.response';

export class QuizQuestionAnswerDetailMapper {
  static toResponse(entity: QuizQuestionAnswerDetail): QuizQuestionAnswerDetailResponse {
    const response = new QuizQuestionAnswerDetailResponse();
    response.id = entity.id;
    response.questionId = entity.question?.id || '';
    response.answerId = entity.answer?.id || '';
    response.createdAt = entity.createdAt;
    response.updatedAt = entity.updatedAt;
    
    return response;
  }

  static toResponseList(entities: QuizQuestionAnswerDetail[]): QuizQuestionAnswerDetailResponse[] {
    return entities.map((entity) => this.toResponse(entity));
  }
}
