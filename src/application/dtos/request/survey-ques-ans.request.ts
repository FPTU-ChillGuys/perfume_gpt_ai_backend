import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsUUID, ValidateNested } from 'class-validator';
import { SurveyQuesAnsDetailRequest } from './survey-ques-ans-detail.request';

/** Request lưu bài survey của người dùng (gồm nhiều câu hỏi - câu trả lời) */
export class SurveyQuesAnwsRequest {
  /** ID người dùng làm survey */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  @IsUUID()
  userId!: string;

  /** Danh sách chi tiết câu hỏi - câu trả lời */
  @ApiProperty({
    description: 'Danh sách câu hỏi - câu trả lời',
    type: [SurveyQuesAnsDetailRequest]
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 câu trả lời' })
  @ValidateNested({ each: true })
  @Type(() => SurveyQuesAnsDetailRequest)
  details = new Array<SurveyQuesAnsDetailRequest>();

  constructor(init?: Partial<SurveyQuesAnwsRequest>) {
    Object.assign(this, init);
  }
}
