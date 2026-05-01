import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';
import { GroupedSurveyQuestionAnswerDetailResponse } from './grouped-survey-question-answer-detail.response';

/** Response bài survey của người dùng */
export class SurveyQuestionAnswerResponse extends CommonResponse {
  /** ID người dùng làm survey */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  userId!: string;

  @ApiProperty({
    description: 'Kết quả AI recommendation (JSON string)',
    required: false
  })
  aiResult?: string;

  /** Danh sách chi tiết câu hỏi - câu trả lời */
  @ApiProperty({
    description: 'Danh sách chi tiết câu hỏi - câu trả lời',
    type: [GroupedSurveyQuestionAnswerDetailResponse]
  })
  details!: GroupedSurveyQuestionAnswerDetailResponse[];

  constructor(init?: Partial<SurveyQuestionAnswerResponse>) {
    super();
    Object.assign(this, init);
  }
}
