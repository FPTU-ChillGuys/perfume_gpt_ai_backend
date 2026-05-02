import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';
import { SurveyAnswerRequest } from './survey-answer.request';
import { QuestionType } from 'src/domain/entities/survey-question.entity';

/** Request tạo câu hỏi survey mới */
export class SurveyQuestionRequest {
  /** Nội dung câu hỏi */
  @ApiProperty({ description: 'Nội dung câu hỏi survey' })
  @IsString()
  @IsNotEmpty()
  question!: string;

  /** Loại câu hỏi (chọn 1 hoặc nhiều đáp án) */
  @ApiPropertyOptional({
    description: 'Loại câu hỏi',
    enum: QuestionType,
    default: QuestionType.SINGLE
  })
  @IsOptional()
  @IsEnum(QuestionType)
  questionType?: QuestionType;

  @ApiPropertyOptional({ description: 'Thứ tự hiển thị', default: 0 })
  @IsOptional()
  @IsNumber()
  order?: number;

  /** Danh sách câu trả lời */
  @ApiProperty({
    description: 'Danh sách câu trả lời',
    type: [SurveyAnswerRequest]
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 câu trả lời' })
  @ValidateNested({ each: true })
  @Type(() => SurveyAnswerRequest)
  answers!: SurveyAnswerRequest[];

  constructor(init?: Partial<SurveyQuestionRequest>) {
    Object.assign(this, init);
  }
}
