import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsUUID, ValidateNested } from 'class-validator';
import { QuizQuesAnsDetailRequest } from './quiz-ques-ans-detail.request';

/** Request lưu bài quiz của người dùng (gồm nhiều câu hỏi - câu trả lời) */
export class QuizQuesAnwsRequest {
  /** ID người dùng làm quiz */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  @IsUUID()
  userId!: string;

  /** Danh sách chi tiết câu hỏi - câu trả lời */
  @ApiProperty({ description: 'Danh sách câu hỏi - câu trả lời', type: [QuizQuesAnsDetailRequest] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 câu trả lời' })
  @ValidateNested({ each: true })
  @Type(() => QuizQuesAnsDetailRequest)
  details = new Array<QuizQuesAnsDetailRequest>();

  constructor(init?: Partial<QuizQuesAnwsRequest>) {
    Object.assign(this, init);
  }
}
