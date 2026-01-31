import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { QuizQuestionResponse } from '../../dtos/response/quiz-question.response';
import { QuizAnswerMapper } from './quiz-answer.mapper';

export class QuizQuestionMapper {
  static toResponse(entity: QuizQuestion, includeAnswers: boolean = false): QuizQuestionResponse {
    const response = new QuizQuestionResponse({
      id: entity.id,
      question: entity.question,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });

    if (includeAnswers && entity.answers.isInitialized()) {
      response.answers = QuizAnswerMapper.toResponseList(entity.answers.getItems());
    }

    return response;
  }

  static toResponseList(entities: QuizQuestion[], includeAnswers: boolean = false): QuizQuestionResponse[] {
    return entities.map((entity) => this.toResponse(entity, includeAnswers));
  }
}
