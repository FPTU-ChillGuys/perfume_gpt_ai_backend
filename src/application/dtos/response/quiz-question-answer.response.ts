import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';
import { QuizQuestionAnswerDetailResponse } from './quiz-question-answer-detail.response';

export class QuizQuestionAnswerResponse extends CommonResponse {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  details!: QuizQuestionAnswerDetailResponse[];

  constructor(init?: Partial<QuizQuestionAnswerResponse>) {
    super();
    Object.assign(this, init);
  }
}
