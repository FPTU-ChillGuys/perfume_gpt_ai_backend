import { ApiProperty } from '@nestjs/swagger';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { MessageResponse } from './message.response';

/** DTO phản hồi cuộc hội thoại */
export class ConversationResponse {
  /** ID cuộc hội thoại */
  @ApiProperty({ description: 'ID cuộc hội thoại' })
  id: string;

  /** ID người dùng sở hữu */
  @ApiProperty({ description: 'ID người dùng' })
  userId: string;

  /** Danh sách tin nhắn */
  @ApiProperty({ description: 'Danh sách tin nhắn', type: [MessageResponse] })
  messages: MessageResponse[] = [];

  /** Ngày cập nhật cuối cùng */
  @ApiProperty({ description: 'Ngày cập nhật' })
  updatedAt: Date;

  /**
   * Chuyển đổi từ Entity sang DTO.
   * @param entity - Entity Conversation từ database
   */
  static fromEntity(entity: Conversation): ConversationResponse | null {
    if (!entity) return null;

    const response = new ConversationResponse();
    response.id = entity.id;
    response.userId = entity.userId;
    response.updatedAt = entity.updatedAt;

    // Map danh sách tin nhắn nếu có
    if (entity.messages && entity.messages.isInitialized()) {
      response.messages = entity.messages
        .getItems()
        .map(msg => MessageResponse.fromEntity(msg)!);
    }

    return response;
  }
}
