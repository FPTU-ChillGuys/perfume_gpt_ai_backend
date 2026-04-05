import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** Request chi tiết câu hỏi - câu trả lời survey */
export class SurveyQuesAnsDetailRequest {
  /** ID câu hỏi */
  @ApiProperty({ description: 'ID câu hỏi survey', format: 'uuid' })
  @IsUUID()
  questionId: string;

  /** ID câu trả lời được chọn */
  @ApiProperty({ description: 'ID câu trả lời được chọn', format: 'uuid' })
  @IsUUID()
  answerId: string;

  constructor(init?: Partial<SurveyQuesAnsDetailRequest>) {
    Object.assign(this, init);
  }
}
