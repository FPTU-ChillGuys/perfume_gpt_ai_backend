import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { QuizQuestionAnswerDetailMapper } from './quiz-question-answer-detail.mapper';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';
import { QuizQuestionAnswerResponse } from 'src/application/dtos/response/quiz-question-answer.response';

export class QuizQuestionAnswerMapper {
  static toResponse(
    entity: QuizQuestionAnswer,
    includeDetails: boolean = false
  ): QuizQuestionAnswerResponse {
    const response = new QuizQuestionAnswerResponse({
      id: entity.id,
      userId: entity.userId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });

    if (includeDetails && entity.details.isInitialized()) {
      response.details = QuizQuestionAnswerDetailMapper.toResponseList(
        entity.details.getItems()
      );
    } else {
      response.details = [];
    }

    return response;
  }

  static toResponseList(
    entities: QuizQuestionAnswer[],
    includeDetails: boolean = false
  ): QuizQuestionAnswerResponse[] {
    return entities.map((entity) => this.toResponse(entity, includeDetails));
  }

  static toEntity({
      userId,
      details
  }: {
      userId: string;
      details: { question: QuizQuestion; answer: QuizAnswer }[];
  }): QuizQuestionAnswer {
    const quesAns = new QuizQuestionAnswer({
      userId: userId
    });

    quesAns.details.set(
      QuizQuestionAnswerDetailMapper.toEntityList(
        details.map(item => ({
          question: item.question,
          answer: item.answer,
          quizQuestionAnswer: quesAns
        }))
      )
    );

    return quesAns;
  }
}
