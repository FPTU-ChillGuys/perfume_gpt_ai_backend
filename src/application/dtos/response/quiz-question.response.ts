import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';
import { QuizAnswerResponse } from './quiz-answer.response';
import { QuestionType } from 'src/domain/entities/quiz-question.entity';

/** Response câu hỏi quiz */
export class QuizQuestionResponse extends CommonResponse {
  /** Loại câu hỏi */
  @ApiProperty({ description: 'Loại câu hỏi', enum: QuestionType, required: false })
  questionType?: QuestionType;

  /** Nội dung câu hỏi */
  @ApiProperty({ description: 'Nội dung câu hỏi', required: false })
  question?: string;

  /** Danh sách câu trả lời */
  @ApiProperty({ description: 'Danh sách câu trả lời', type: () => [QuizAnswerResponse], required: false })
  answers?: QuizAnswerResponse[];

  constructor(init?: Partial<QuizQuestionResponse>) {
    super();
    Object.assign(this, init);
  }
}
