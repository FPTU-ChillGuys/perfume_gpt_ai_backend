import { QuizQuestionAnswerDetail } from 'src/domain/entities/quiz-question-answer-detail.entity';
import { QuizQuestionAnswerDetailResponse } from '../../dtos/response/quiz-question-answer-detail.response';
import { AddQuesAnwsRequest } from 'src/application/dtos/request/ques-ans.request';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';

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

   static toEntity(
    request: AddQuesAnwsRequest,
    question?: QuizQuestion,
    answer?: QuizAnswer,
    quesAns?: QuizQuestionAnswer
  ): QuizQuestionAnswerDetail {
    const detail = new QuizQuestionAnswerDetail();

    // Set question if provided
    if (question) {
      detail.question = question;
    }

    // Set answer if provided
    if (answer) {
      detail.answer = answer;
    }

    // Set quesAns if provided
    if (quesAns) {
      detail.quesAns = quesAns;
    }

    return detail;
  }

  // static toEntityList(
  //   requests: AddQuesAnwsRequest[],
  //   questions?: Map<string, QuizQuestion>,
  //   answers?: Map<string, QuizAnswer>,
  //   quesAns?: QuizQuestionAnswer
  // ): QuizQuestionAnswerDetail[] {
  //   return requests.map((request) => {
  //     const question = questions?.get(request.questionId);
  //     const answer = answers?.get(request.answerId);
  //     return this.toEntity(request, question, answer, quesAns);
  //   });
  // }
}
