import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { QuizQuesAnsDetailRequest } from './quiz-ques-ans-detail.request';

export class QuizQuesAnwsRequest {
  @ApiProperty()
  userId!: string;
  
  @ApiProperty()
  details = new Array<QuizQuesAnsDetailRequest>();

  constructor(init?: Partial<QuizQuesAnwsRequest>) {
    Object.assign(this, init);
  }
}
