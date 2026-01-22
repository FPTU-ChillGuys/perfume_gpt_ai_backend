import { CommonResponse } from './common/common.response';

export class QuizAnswerResponse extends CommonResponse {
  questionId!: string;
  answer!: string;
}
