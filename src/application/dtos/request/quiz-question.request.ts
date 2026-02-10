import { ApiProperty } from '@nestjs/swagger';
import { QuizAnswerRequest } from './quiz-answer.request';

/** Request tạo câu hỏi quiz mới */
export class QuizQuestionRequest {
  /** Nội dung câu hỏi */
  @ApiProperty({ description: 'Nội dung câu hỏi quiz' })
  question!: string;

  /** Danh sách câu trả lời */
  @ApiProperty({ description: 'Danh sách câu trả lời', type: [QuizAnswerRequest] })
  answers!: QuizAnswerRequest[];

  constructor(init?: Partial<QuizQuestionRequest>) {
    Object.assign(this, init);
  }
}
