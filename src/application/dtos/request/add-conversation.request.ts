import { ApiProperty } from '@nestjs/swagger';

export class AddConversationRequest {
  @ApiProperty()
  userId!: string;
}
