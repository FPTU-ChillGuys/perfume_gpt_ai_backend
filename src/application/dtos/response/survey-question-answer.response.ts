import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';
import { SurveyQuestionAnswerDetailResponse } from './survey-question-answer-detail.response';

/** Response bài survey của người dùng */
export class SurveyQuestionAnswerResponse extends CommonResponse {
  /** ID người dùng làm survey */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  userId!: string;

  /** Danh sách chi tiết câu hỏi - câu trả lời */
  @ApiProperty({ description: 'Danh sách chi tiết câu hỏi - câu trả lời', type: [SurveyQuestionAnswerDetailResponse] })
  details!: SurveyQuestionAnswerDetailResponse[];

  constructor(init?: Partial<SurveyQuestionAnswerResponse>) {
    super();
    Object.assign(this, init);
  }
}
