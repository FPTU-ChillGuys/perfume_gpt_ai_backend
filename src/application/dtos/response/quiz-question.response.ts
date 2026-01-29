import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';
import { QuizAnswerResponse } from './quiz-answer.response';

export class QuizQuestionResponse extends CommonResponse {
  @ApiProperty()
  question?: string;

  @ApiProperty({ type: () => [QuizAnswerResponse] })
  answers?: QuizAnswerResponse[];

  constructor(init?: Partial<QuizQuestionResponse>) {
    super();
    Object.assign(this, init);
  }
}
