import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { QuizAnswerRequest } from './quiz-answer.request';
import { QuestionType } from 'src/domain/entities/quiz-question.entity';

/** Request tạo câu hỏi quiz mới */
export class QuizQuestionRequest {
  /** Nội dung câu hỏi */
  @ApiProperty({ description: 'Nội dung câu hỏi quiz' })
  @IsString()
  @IsNotEmpty()
  question!: string;

  /** Loại câu hỏi (chọn 1 hoặc nhiều đáp án) */
  @ApiPropertyOptional({ description: 'Loại câu hỏi', enum: QuestionType, default: QuestionType.SINGLE })
  @IsOptional()
  @IsEnum(QuestionType)
  questionType?: QuestionType;

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
