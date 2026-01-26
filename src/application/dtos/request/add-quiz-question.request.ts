import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { QuizAnswerRequest } from './add-quiz-answer.request';

export class QuizQuestionRequest {
  @ApiProperty()
  question!: string;
  @ApiProperty({ type: [QuizAnswerRequest] })
  answers!: QuizAnswerRequest[];
}
