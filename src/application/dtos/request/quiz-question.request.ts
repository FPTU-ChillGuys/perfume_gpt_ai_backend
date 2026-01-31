import { ApiProperty } from '@nestjs/swagger';
import { QuizAnswerRequest } from './quiz-answer.request';

export class QuizQuestionRequest {
  @ApiProperty()
  question!: string;
  @ApiProperty({ type: [QuizAnswerRequest] })
  answers!: QuizAnswerRequest[];

  constructor(init?: Partial<QuizQuestionRequest>) {
    Object.assign(this, init);
  }
}
