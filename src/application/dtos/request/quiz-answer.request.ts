import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Request tạo câu trả lời quiz */
export class QuizAnswerRequest {
  /** Nội dung câu trả lời */
  @ApiProperty({ description: 'Nội dung câu trả lời' })
  @IsString()
  @IsNotEmpty()
  answer!: string;

  constructor(init?: Partial<QuizAnswerRequest>) {
    Object.assign(this, init);
  }
}
