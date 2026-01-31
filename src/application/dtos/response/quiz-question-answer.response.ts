import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';
import { QuizQuestionAnswerDetailResponse } from './quiz-question-answer-detail.response';

export class QuizQuestiomAnswerResponse extends CommonResponse {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  details!: QuizQuestionAnswerDetailResponse[];

  constructor(init?: Partial<QuizQuestiomAnswerResponse>) {
    super();
    Object.assign(this, init);
  }
}
