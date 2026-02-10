import { ApiProperty } from '@nestjs/swagger';

/** Request tạo câu trả lời quiz */
export class QuizAnswerRequest {
  /** Nội dung câu trả lời */
  @ApiProperty({ description: 'Nội dung câu trả lời' })
  answer!: string;

  constructor(init?: Partial<QuizAnswerRequest>) {
    Object.assign(this, init);
  }
}
