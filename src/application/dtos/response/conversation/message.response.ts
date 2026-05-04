import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sender } from 'src/domain/enum/sender.enum';
import { Message } from 'src/domain/entities/message.entity';
import {
  ProductCardOutputItemDto,
  ProductTempItemDto
} from '../../common/conversation-output.dto';

/** DTO phản hồi tin nhắn trong cuộc hội thoại */
export class MessageResponse {
  /** Người gửi tin nhắn */
  @ApiProperty({
    description: 'Người gửi tin nhắn (user hoặc assistant)',
    required: true,
    enum: Sender
  })
  sender!: Sender;

  /** Nội dung tin nhắn dạng text */
  @ApiProperty({
    description: 'Nội dung tin nhắn dạng text',
    required: true,
    type: String
  })
  message!: string;

  /** Danh sách sản phẩm (chỉ có khi sender=assistant) */
  @ApiPropertyOptional({
    description: 'Danh sách sản phẩm gợi ý',
    type: [ProductCardOutputItemDto],
    nullable: true
  })
  products?: ProductCardOutputItemDto[] | null;

  /** Danh sách sản phẩm tạm (chỉ có khi sender=assistant) */
  @ApiPropertyOptional({
    description: 'Danh sách sản phẩm tạm',
    type: [ProductTempItemDto],
    nullable: true
  })
  productTemp?: ProductTempItemDto[] | null;

  /** Gợi ý câu hỏi tiếp theo (chỉ có khi sender=assistant) */
  @ApiPropertyOptional({
    description: 'Gợi ý 3-4 câu hỏi tiếp theo',
    type: [String],
    nullable: true
  })
  suggestedQuestions?: string[] | null;

  /** Ngày tạo */
  @ApiProperty({ description: 'Ngày tạo' })
  createdAt!: Date;

  /**
   * Chuyển đổi từ Entity sang DTO.
   * @param entity - Entity Message từ database
   */
  static fromEntity(entity: Message): MessageResponse | null {
    if (!entity) return null;

    const response = new MessageResponse();
    response.sender = entity.sender;
    response.message = entity.message;
    response.products = null;
    response.productTemp = null;
    response.suggestedQuestions = null;
    response.createdAt = entity.createdAt;

    return response;
  }
}
