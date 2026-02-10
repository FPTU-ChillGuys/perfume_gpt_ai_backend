import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';

/** Response câu trả lời quiz */
export class QuizAnswerResponse extends CommonResponse {
  /** ID câu hỏi liên quan */
  @ApiProperty({ description: 'ID câu hỏi', format: 'uuid', required: false })
  questionId?: string;

  /** Nội dung câu trả lời */
  @ApiProperty({ description: 'Nội dung câu trả lời', required: false })
  answer?: string;

  constructor(init?: Partial<QuizAnswerResponse>) {
    super();
    Object.assign(this, init);
  }
}
