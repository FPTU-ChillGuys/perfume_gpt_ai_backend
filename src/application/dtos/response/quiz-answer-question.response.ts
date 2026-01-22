import { CommonResponse } from './common.response';

export class QuizAnswerQuestionResponse extends CommonResponse {
  userId!: string;
  questionId!: string;
  answerId!: string;
  ai_result!: string;
}
