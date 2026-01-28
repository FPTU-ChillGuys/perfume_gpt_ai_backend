import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';
import { MessageResponse } from './message.response';

export class ConversationResponse extends CommonResponse {
  @ApiProperty()
  userId!: string;
  @ApiProperty({ type: [MessageResponse] })
  messages!: MessageResponse[];

  constructor(init?: Partial<ConversationResponse>) {
    super();
    Object.assign(this, init);
  }
}
