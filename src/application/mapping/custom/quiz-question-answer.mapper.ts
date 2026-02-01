import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { QuizQuestiomAnswerResponse } from '../../dtos/response/quiz-question-answer.response';
import { QuizQuestionAnswerDetailMapper } from './quiz-question-answer-detail.mapper';
import { QuizQuesAnwsRequest } from 'src/application/dtos/request/quiz-ques-ans.request';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';

export class QuizQuestionAnswerMapper {
  static toResponse(
    entity: QuizQuestionAnswer,
    includeDetails: boolean = false
  ): QuizQuestiomAnswerResponse {
    const response = new QuizQuestiomAnswerResponse({
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
  ): QuizQuestiomAnswerResponse[] {
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
