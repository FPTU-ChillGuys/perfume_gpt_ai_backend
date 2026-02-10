import { ApiProperty } from '@nestjs/swagger';
import { MessageDto, MessageRequestDto } from './message.dto';
import { CommonResponse } from '../response/common/common.response';

/** DTO cuộc hội thoại (response) */
export class ConversationDto extends CommonResponse{
  /** ID người dùng sở hữu cuộc hội thoại */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid', required: false })
  userId?: string;

  /** Danh sách tin nhắn trong cuộc hội thoại */
  @ApiProperty({ description: 'Danh sách tin nhắn', type: () => [MessageDto], required: false })
  messages?: MessageDto[];

  constructor(init?: Partial<ConversationDto>) {
    super()
    Object.assign(this, init);
  }
}

/** DTO cuộc hội thoại (request) */
export class ConversationRequestDto {

  /** ID cuộc hội thoại */
  @ApiProperty({ description: 'ID cuộc hội thoại', format: 'uuid' })
  id!: string;

  /** ID người dùng */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  userId!: string;

  /** Danh sách tin nhắn */
  @ApiProperty({ description: 'Danh sách tin nhắn', type: () => [MessageRequestDto] })
  messages!: MessageRequestDto[];

  constructor(init?: Partial<ConversationRequestDto>) {
    Object.assign(this, init);
  }

}