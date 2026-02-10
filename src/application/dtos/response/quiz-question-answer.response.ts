import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';
import { QuizQuestionAnswerDetailResponse } from './quiz-question-answer-detail.response';

/** Response bài quiz của người dùng */
export class QuizQuestionAnswerResponse extends CommonResponse {
  /** ID người dùng làm quiz */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  userId!: string;

  /** Danh sách chi tiết câu hỏi - câu trả lời */
  @ApiProperty({ description: 'Danh sách chi tiết câu hỏi - câu trả lời', type: [QuizQuestionAnswerDetailResponse] })
  details!: QuizQuestionAnswerDetailResponse[];

  constructor(init?: Partial<QuizQuestionAnswerResponse>) {
    super();
    Object.assign(this, init);
  }
}
