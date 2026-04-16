import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Request tạo câu trả lời survey */
export class SurveyAnswerRequest {
  /** Nội dung câu trả lời (text thuần hoặc JSON payload chứa queryFragment) */
  @ApiProperty({ description: 'Nội dung câu trả lời' })
  @IsString()
  @IsNotEmpty()
  answer!: string;

  /** Optional: Query fragment dùng cho survey v4 query-based mode.
   *  Khi được cung cấp, backend sẽ serialize cả displayText + queryFragment vào field answer. */
  @ApiPropertyOptional({ description: 'Query fragment cho survey v4' })
  @IsOptional()
  queryFragment?: Record<string, any>;

  constructor(init?: Partial<SurveyAnswerRequest>) {
    Object.assign(this, init);
  }
}
