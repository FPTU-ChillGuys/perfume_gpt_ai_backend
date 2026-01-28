import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';

export class QuizAnswerQuestionResponse extends CommonResponse {
  @ApiProperty()
  userId!: string;
  @ApiProperty()
  questionId!: string;
  @ApiProperty()
  answerId!: string;
  @ApiProperty()
  ai_result!: string;

  constructor(init?: Partial<QuizAnswerQuestionResponse>) {
    super();
    Object.assign(this, init);
  }
}
