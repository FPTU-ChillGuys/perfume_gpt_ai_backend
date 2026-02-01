import { QuizQuestionAnswerDetail } from 'src/domain/entities/quiz-question-answer-detail.entity';
import { QuizQuestionAnswerDetailResponse } from '../../dtos/response/quiz-question-answer-detail.response';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';
import { QuizQuesAnwsRequest } from 'src/application/dtos/request/quiz-ques-ans.request';
import { QuizQuesAnsDetailRequest } from 'src/application/dtos/request/quiz-ques-ans-detail.request';

export class QuizQuestionAnswerDetailMapper {
  constructor(private quizQuestionAnswer: QuizQuestionAnswer) {}

  static toResponse(
    entity: QuizQuestionAnswerDetail
  ): QuizQuestionAnswerDetailResponse {
    const response = new QuizQuestionAnswerDetailResponse();
    response.id = entity.id;
    response.questionId = entity.question?.id || '';
    response.answerId = entity.answer?.id || '';
    response.createdAt = entity.createdAt;
    response.updatedAt = entity.updatedAt;

    return response;
  }

  static toResponseList(
    entities: QuizQuestionAnswerDetail[]
  ): QuizQuestionAnswerDetailResponse[] {
    return entities.map((entity) => this.toResponse(entity));
  }

  static toEntity(
    question: QuizQuestion,
    answer: QuizAnswer,
    quizQuestionAnswer: QuizQuestionAnswer
  ): QuizQuestionAnswerDetail {
    const detail = new QuizQuestionAnswerDetail();

    detail.question = question;
    detail.answer = answer;
    detail.quesAns = quizQuestionAnswer;

    return detail;
  }

  static toEntityList(
    items: {
      question: QuizQuestion;
      answer: QuizAnswer;
      quizQuestionAnswer: QuizQuestionAnswer;
    }[]
  ): QuizQuestionAnswerDetail[] {
    return items.map((item) =>
      this.toEntity(
        item.question,
        item.answer,
        item.quizQuestionAnswer
      )
    );
  }
}
