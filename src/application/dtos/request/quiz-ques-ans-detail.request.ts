import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** Request chi tiết câu hỏi - câu trả lời quiz */
export class QuizQuesAnsDetailRequest {
  /** ID câu hỏi */
  @ApiProperty({ description: 'ID câu hỏi quiz', format: 'uuid' })
  @IsUUID()
  questionId: string;

  /** ID câu trả lời được chọn */
  @ApiProperty({ description: 'ID câu trả lời được chọn', format: 'uuid' })
  @IsUUID()
  answerId: string;

  constructor(init?: Partial<QuizQuesAnsDetailRequest>) {
    Object.assign(this, init);
  }
}
