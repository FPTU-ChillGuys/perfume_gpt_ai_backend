import { ApiProperty } from "@nestjs/swagger";

export class QuizQuesAnsDetailRequest {
  @ApiProperty()
  questionId: string;
  @ApiProperty()
  answerId: string;

  constructor(init?: Partial<QuizQuesAnsDetailRequest>) {
    Object.assign(this, init);
  }
}
