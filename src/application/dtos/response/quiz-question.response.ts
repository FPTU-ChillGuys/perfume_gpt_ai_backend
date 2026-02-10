import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';
import { QuizAnswerResponse } from './quiz-answer.response';

/** Response câu hỏi quiz */
export class QuizQuestionResponse extends CommonResponse {
  /** Nội dung câu hỏi */
  @ApiProperty({ description: 'Nội dung câu hỏi', required: false })
  question?: string;

  /** Danh sách câu trả lời */
  @ApiProperty({ description: 'Danh sách câu trả lời', type: () => [QuizAnswerResponse], required: false })
  answers?: QuizAnswerResponse[];

  constructor(init?: Partial<QuizQuestionResponse>) {
    super();
    Object.assign(this, init);
  }
}
