import { QuizAnswerRequest } from '../../dtos/request/add-quiz-answer.request';
import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';

export class QuizAnswerRequestMapper {
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
