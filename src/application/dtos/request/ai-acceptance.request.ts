import { ApiProperty } from '@nestjs/swagger';

export class AIAcceptanceRequest {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  isAccepted: boolean;

  constructor(init?: Partial<AIAcceptanceRequest>) {
    Object.assign(this, init);
  }
}
