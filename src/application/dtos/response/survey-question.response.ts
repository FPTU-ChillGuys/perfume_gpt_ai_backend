import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';
import { SurveyAnswerResponse } from './survey-answer.response';
import { QuestionType } from 'src/domain/entities/survey-question.entity';

/** Response câu hỏi survey */
export class SurveyQuestionResponse extends CommonResponse {
  /** Loại câu hỏi */
  @ApiProperty({
    description: 'Loại câu hỏi',
    enum: QuestionType,
    required: false
  })
  questionType?: QuestionType;

  /** Nội dung câu hỏi */
  @ApiProperty({ description: 'Nội dung câu hỏi', required: false })
  question?: string;

  @ApiProperty({ description: 'Thứ tự hiển thị', required: false })
  order?: number;

  /** Danh sách câu trả lời */
  @ApiProperty({
    description: 'Danh sách câu trả lời',
    type: () => [SurveyAnswerResponse],
    required: false
  })
  answers?: SurveyAnswerResponse[];

  constructor(init?: Partial<SurveyQuestionResponse>) {
    super();
    Object.assign(this, init);
  }
}
