import { ApiProperty } from '@nestjs/swagger';
import { MessageDto, MessageRequestDto } from './message.dto';
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

export class ConversationRequestDto {

  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: () => [MessageRequestDto] })
  messages!: MessageRequestDto[];

  constructor(init?: Partial<ConversationRequestDto>) {
    Object.assign(this, init);
  }

}