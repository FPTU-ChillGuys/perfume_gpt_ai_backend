import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Request tạo câu trả lời survey */
export class SurveyAnswerRequest {
  /** Nội dung câu trả lời */
  @ApiProperty({ description: 'Nội dung câu trả lời' })
  @IsString()
  @IsNotEmpty()
  answer!: string;

  constructor(init?: Partial<SurveyAnswerRequest>) {
    Object.assign(this, init);
  }
}
