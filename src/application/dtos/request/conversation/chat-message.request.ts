import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Sender } from 'src/domain/enum/sender.enum';
import { Message } from 'src/domain/entities/message.entity';

/** DTO yêu cầu gửi tin nhắn */
export class ChatMessageRequest {
  /** Người gửi tin nhắn (USER hoặc ASSISTANT) */
  @ApiProperty({ description: 'Người gửi tin nhắn', enum: Sender })
  @IsEnum(Sender)
  sender: Sender;

  /** Nội dung tin nhắn */
  @ApiProperty({ description: 'Nội dung tin nhắn' })
  @IsString()
  @IsNotEmpty()
  message: string;

  /**
   * Chuyển đổi từ DTO sang Entity.
   * @returns Entity Message mới
   */
  toEntity(): Message {
    const entity = new Message();
    entity.sender = this.sender;
    entity.message = this.message;
    return entity;
  }
}
