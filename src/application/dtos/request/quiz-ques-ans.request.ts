import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { QuizQuesAnsDetailRequest } from './quiz-ques-ans-detail.request';

/** Request lưu bài quiz của người dùng (gồm nhiều câu hỏi - câu trả lời) */
export class QuizQuesAnwsRequest {
  /** ID người dùng làm quiz */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  userId!: string;
  
  /** Danh sách chi tiết câu hỏi - câu trả lời */
  @ApiProperty({ description: 'Danh sách câu hỏi - câu trả lời', type: [QuizQuesAnsDetailRequest] })
  details = new Array<QuizQuesAnsDetailRequest>();

  constructor(init?: Partial<QuizQuesAnwsRequest>) {
    Object.assign(this, init);
  }
}
