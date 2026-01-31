import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { QuizQuestionResponse } from '../../dtos/response/quiz-question.response';
import { QuizAnswerMapper } from './quiz-answer.mapper';
import { QuizQuestionRequest } from 'src/application/dtos/request/quiz-question.request';

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

  static toEntity(request: QuizQuestionRequest): QuizQuestion {
    const quizQuestion = new QuizQuestion({
      question: request.question
    });

    // Map answers if provided
    if (request.answers && request.answers.length > 0) {
      const answers = request.answers.map(answerRequest =>
        QuizAnswerMapper.toEntity(answerRequest, quizQuestion)
      );
      quizQuestion.answers.set(answers);
    }

    return quizQuestion;
  }

  static toEntityList(requests: QuizQuestionRequest[]): QuizQuestion[] {
    return requests.map((request) => this.toEntity(request));
  }

  static updateEntity(entity: QuizQuestion, request: QuizQuestionRequest): QuizQuestion {
    if (request.question) {
      entity.question = request.question;
    }

    if (request.answers) {
      const answers = request.answers.map(answerRequest =>
        QuizAnswerMapper.toEntity(answerRequest, entity)
      );
      entity.answers.set(answers);
    }

    return entity;
  }
}
