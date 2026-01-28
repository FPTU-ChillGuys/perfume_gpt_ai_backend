import { CommonResponse } from './common/common.response';

export class QuizAnswerQuestionResponse extends CommonResponse {
  userId!: string;
  questionId!: string;
  answerId!: string;
  ai_result!: string;

  constructor(init?: Partial<QuizAnswerQuestionResponse>) {
    super();
    Object.assign(this, init);
  }
}
