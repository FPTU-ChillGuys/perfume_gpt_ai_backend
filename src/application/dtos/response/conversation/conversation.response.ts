import { ApiProperty } from '@nestjs/swagger';
import { Conversation } from 'src/domain/entities/conversation.entity';
import { MessageResponse } from './message.response';

/** DTO phản hồi cuộc hội thoại */
export class ConversationResponse {
  /** ID cuộc hội thoại */
  @ApiProperty({ description: 'ID cuộc hội thoại' })
  id!: string;

  /** ID người dùng sở hữu */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid', required: true })
  userId!: string;

  /** Danh sách tin nhắn */
  @ApiProperty({
    description: 'Danh sách tin nhắn',
    type: [MessageResponse],
    required: true
  })
  messages: MessageResponse[] = [];

  /** Ngày cập nhật cuối cùng */
  @ApiProperty({ description: 'Ngày cập nhật' })
  updatedAt!: Date;

  /** Đánh dấu response được xử lý cho Mobile */
  @ApiProperty({
    description: 'Đánh dấu response cho Mobile',
    required: false,
    default: false
  })
  isMobile?: boolean;

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

    if (entity.messages && entity.messages.isInitialized()) {
      const messages = entity.messages.getItems();
      messages.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      });
      response.messages = messages.map(
        (msg) => MessageResponse.fromEntity(msg)!
      );
    }

    return response;
  }
}
