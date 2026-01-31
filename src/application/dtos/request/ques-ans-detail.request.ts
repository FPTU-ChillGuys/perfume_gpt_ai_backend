import { ApiProperty } from "@nestjs/swagger";

export class QuestAnsDetailRequest {
  @ApiProperty()
  questionId: string;
  @ApiProperty()
  answerId: string;

  constructor(init?: Partial<QuestAnsDetailRequest>) {
    Object.assign(this, init);
  }
}
