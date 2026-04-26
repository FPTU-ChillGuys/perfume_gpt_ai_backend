import { ApiProperty } from '@nestjs/swagger';
import { Sender } from 'src/domain/enum/sender.enum';
import { Message } from 'src/domain/entities/message.entity';

/** DTO phản hồi tin nhắn trong cuộc hội thoại */
export class MessageResponse {
  /** Người gửi tin nhắn */
  @ApiProperty({ description: 'Người gửi tin nhắn', enum: Sender })
  sender: Sender;

  /** Nội dung tin nhắn */
  @ApiProperty({ description: 'Nội dung tin nhắn' })
  message: string;

  /** ID tin nhắn */
  @ApiProperty({ description: 'ID tin nhắn' })
  id: string;

  /** Ngày tạo */
  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  /**
   * Chuyển đổi từ Entity sang DTO.
   * @param entity - Entity Message từ database
   */
  static fromEntity(entity: Message): MessageResponse | null {
    if (!entity) return null;
    
    const response = new MessageResponse();
    response.id = entity.id;
    response.sender = entity.sender;
    response.message = entity.message;
    response.createdAt = entity.createdAt;
    
    return response;
  }
}
