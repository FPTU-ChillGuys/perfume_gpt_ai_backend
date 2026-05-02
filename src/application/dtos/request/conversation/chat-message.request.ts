import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateIf
} from 'class-validator';
import { Sender } from 'src/domain/enum/sender.enum';
import { Message } from 'src/domain/entities/message.entity';
import { ConversationOutputDto } from '../../common/conversation-output.dto';

/** DTO yêu cầu gửi tin nhắn */
export class ChatMessageRequest {
  /** Người gửi tin nhắn (USER hoặc ASSISTANT) */
  @ApiProperty({
    description: 'Người gửi tin nhắn (user hoặc assistant)',
    required: true,
    enum: Sender
  })
  @IsEnum(Sender)
  sender: Sender;

  /** Nội dung tin nhắn */
  @ApiProperty({
    description: 'Nội dung tin nhắn',
    required: true,
    oneOf: [
      { type: 'string' },
      { $ref: '#/components/schemas/ConversationOutputDto' }
    ]
  })
  @ValidateIf((o) => typeof o.message !== 'string')
  @IsObject()
  @ValidateIf((o) => typeof o.message === 'string')
  @IsString()
  @IsNotEmpty()
  message: string | ConversationOutputDto;

  /**
   * Chuyển đổi từ DTO sang Entity.
   * @returns Entity Message mới
   */
  toEntity(): Message {
    const entity = new Message();
    entity.sender = this.sender;
    entity.message =
      typeof this.message === 'string'
        ? this.message
        : JSON.stringify(this.message);
    return entity;
  }
}
