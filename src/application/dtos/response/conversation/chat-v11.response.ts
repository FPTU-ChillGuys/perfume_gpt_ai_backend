import { ApiProperty } from '@nestjs/swagger';
import { Sender } from 'src/domain/enum/sender.enum';

export class ChatV11AiMessage {
  @ApiProperty({ description: 'Người gửi (luôn là assistant)', enum: ['assistant'] })
  sender: Sender = "user" as Sender;

  @ApiProperty({ description: 'Nội dung tin nhắn AI trả lời' })
  message!: string;

  @ApiProperty({ description: 'Thời gian tạo message' })
  createdAt!: Date;
}

export class ChatV11Response {
  @ApiProperty({ description: 'ID cuộc hội thoại' })
  conversationId!: string;

  @ApiProperty({ description: 'Tin nhắn AI phản hồi', type: ChatV11AiMessage })
  aiMessage: ChatV11AiMessage = new ChatV11AiMessage;
}