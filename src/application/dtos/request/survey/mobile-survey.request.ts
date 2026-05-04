import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MobileSurveyAnswer {
  @ApiProperty({ description: 'ID câu hỏi' })
  @IsString()
  questionId!: string;

  @ApiProperty({ description: 'ID câu trả lời' })
  @IsString()
  answerId!: string;
}

export class MobileSurveyRequest {
  @ApiProperty({ description: 'ID người dùng' })
  @IsString()
  userId!: string;

  @ApiProperty({
    type: [MobileSurveyAnswer],
    description: 'Danh sách câu trả lời'
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MobileSurveyAnswer)
  answers!: MobileSurveyAnswer[];
}