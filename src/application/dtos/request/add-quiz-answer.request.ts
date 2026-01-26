import { ApiProperty } from '@nestjs/swagger';

export class QuizAnswerRequest {
  @ApiProperty()
  answer!: string;
}
