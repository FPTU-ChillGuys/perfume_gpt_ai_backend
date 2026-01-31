import { QuizQuestionRequest } from '../../dtos/request/add-quiz-question.request';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { QuizAnswerRequestMapper } from './quiz-answer-request.mapper';

export class QuizQuestionRequestMapper {
  static toEntity(request: QuizQuestionRequest): QuizQuestion {
    const quizQuestion = new QuizQuestion({
      question: request.question
    });

    // Map answers if provided
    if (request.answers && request.answers.length > 0) {
      const answers = request.answers.map(answerRequest =>
        QuizAnswerRequestMapper.toEntity(answerRequest, quizQuestion)
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
        QuizAnswerRequestMapper.toEntity(answerRequest, entity)
      );
      entity.answers.set(answers);
    }

    return entity;
  }
}
