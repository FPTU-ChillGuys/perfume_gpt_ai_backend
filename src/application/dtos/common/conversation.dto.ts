import { ApiProperty } from '@nestjs/swagger';
import { MessageDto } from './message.dto';
import { CommonResponse } from '../response/common/common.response';

export class ConversationDto extends CommonResponse{
  @ApiProperty()
  userId?: string;
  @ApiProperty({ type: () => [MessageDto] })
  messages?: MessageDto[];

  constructor(init?: Partial<ConversationDto>) {
    super()
    Object.assign(this, init);
  }
}
