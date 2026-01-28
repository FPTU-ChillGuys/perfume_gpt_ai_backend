import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';

export class QuizQuestionResponse extends CommonResponse {
  @ApiProperty()
  question!: string;

  constructor(init?: Partial<QuizQuestionResponse>) {
    super();
    Object.assign(this, init);
  }
}
