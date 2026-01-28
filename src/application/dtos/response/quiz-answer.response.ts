import { CommonResponse } from './common/common.response';

export class QuizAnswerResponse extends CommonResponse {
  questionId!: string;
  answer!: string;

  constructor(init?: Partial<QuizAnswerResponse>) {
    super();
    Object.assign(this, init);
  }
}
