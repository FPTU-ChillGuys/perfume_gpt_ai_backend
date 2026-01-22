import { CommonResponse } from './common.response';

export class QuizAnswerResponse extends CommonResponse {
  questionId!: string;
  answer!: string;
}
