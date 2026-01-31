import { AddQuesAnwsRequest } from '../../dtos/request/add-ques-ans.request';
import { QuizQuestionAnswerDetail } from 'src/domain/entities/quiz-question-answer-detail.entity';
import { QuizQuestion } from 'src/domain/entities/quiz-question.entity';
import { QuizAnswer } from 'src/domain/entities/quiz-answer.entity';
import { QuizQuestionAnswer } from 'src/domain/entities/quiz-question-answer.entity';

export class QuizQuestionAnswerDetailRequestMapper {
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

  static toEntityList(
    requests: AddQuesAnwsRequest[],
    questions?: Map<string, QuizQuestion>,
    answers?: Map<string, QuizAnswer>,
    quesAns?: QuizQuestionAnswer
  ): QuizQuestionAnswerDetail[] {
    return requests.map((request) => {
      const question = questions?.get(request.questionId);
      const answer = answers?.get(request.answerId);
      return this.toEntity(request, question, answer, quesAns);
    });
  }
}
