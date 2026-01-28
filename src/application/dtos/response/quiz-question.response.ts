import { CommonResponse } from './common/common.response';

export class QuizQuestionResponse extends CommonResponse {
  question!: string;

  constructor(init?: Partial<QuizQuestionResponse>) {
    super();
    Object.assign(this, init);
  }
}
