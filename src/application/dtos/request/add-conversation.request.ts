import { ApiProperty } from '@nestjs/swagger';
import { AddMessageRequest } from './add-message.request';

export class AddConversationRequest {
  @ApiProperty()
  userId!: string;
  @ApiProperty({ type: [AddMessageRequest] })
  messages!: AddMessageRequest[];
}
