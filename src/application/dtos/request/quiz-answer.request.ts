import { ApiProperty } from '@nestjs/swagger';

export class QuizAnswerRequest {
  @ApiProperty()
  answer!: string;

  constructor(init?: Partial<QuizAnswerRequest>) {
    Object.assign(this, init);
  }
}
