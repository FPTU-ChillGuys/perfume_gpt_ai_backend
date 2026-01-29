import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';

export class QuizAnswerResponse extends CommonResponse {
  @ApiProperty()
  questionId?: string;
  @ApiProperty()
  answer?: string;

  constructor(init?: Partial<QuizAnswerResponse>) {
    super();
    Object.assign(this, init);
  }
}
