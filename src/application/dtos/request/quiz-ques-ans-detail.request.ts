import { ApiProperty } from "@nestjs/swagger";

/** Request chi tiết câu hỏi - câu trả lời quiz */
export class QuizQuesAnsDetailRequest {
  /** ID câu hỏi */
  @ApiProperty({ description: 'ID câu hỏi quiz', format: 'uuid' })
  questionId: string;

  /** ID câu trả lời được chọn */
  @ApiProperty({ description: 'ID câu trả lời được chọn', format: 'uuid' })
  answerId: string;

  constructor(init?: Partial<QuizQuesAnsDetailRequest>) {
    Object.assign(this, init);
  }
}
