import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';
import { QuizAnswerResponse } from '../../dtos/response/quiz-answer.response';
import { QuizAnswerRequest } from 'src/application/dtos/request/quiz-answer.request';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';

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

  static toEntity(request: QuizAnswerRequest, question?: QuizQuestion): QuizAnswer {
    const quizAnswer = new QuizAnswer({
      answer: request.answer
    });

    // Set question if provided
    if (question) {
      quizAnswer.question = question;
    }

    return quizAnswer;
  }

  static toEntityList(requests: QuizAnswerRequest[], question?: QuizQuestion): QuizAnswer[] {
    return requests.map((request) => this.toEntity(request, question));
  }

  static updateEntity(entity: QuizAnswer, request: QuizAnswerRequest): QuizAnswer {
    if (request.answer) {
      entity.answer = request.answer;
    }

    return entity;
  }
}

