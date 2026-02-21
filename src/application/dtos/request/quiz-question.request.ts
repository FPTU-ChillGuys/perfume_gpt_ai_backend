import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { QuizAnswerRequest } from './quiz-answer.request';

/** Request tạo câu hỏi quiz mới */
export class QuizQuestionRequest {
  /** Nội dung câu hỏi */
  @ApiProperty({ description: 'Nội dung câu hỏi quiz' })
  @IsString()
  @IsNotEmpty()
  question!: string;

  /** Danh sách câu trả lời */
  @ApiProperty({ description: 'Danh sách câu trả lời', type: [QuizAnswerRequest] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 câu trả lời' })
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerRequest)
  answers!: QuizAnswerRequest[];

  constructor(init?: Partial<QuizQuestionRequest>) {
    Object.assign(this, init);
  }
}
