import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';
import { QuizAnswerResponse } from '../../dtos/response/quiz-answer.response';

export class QuizAnswerMapper {
  static toResponse(entity: QuizAnswer): QuizAnswerResponse {
    return new QuizAnswerResponse({
      id: entity.id,
      questionId: entity.question?.id,
      answer: entity.answer,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });
  }

  static toResponseList(entities: QuizAnswer[]): QuizAnswerResponse[] {
    return entities.map((entity) => this.toResponse(entity));
  }
}
