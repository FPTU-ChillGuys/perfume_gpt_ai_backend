import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { Sender } from 'src/domain/enum/sender.enum';
import { Message } from 'src/domain/entities/message.entity';
import {
  ConversationOutputDto,
  ProductCardOutputItemDto,
  ProductTempItemDto
} from '../../common/conversation-output.dto';

/** DTO yêu cầu gửi tin nhắn */
export class ChatMessageRequest {
  /** Người gửi tin nhắn (USER hoặc ASSISTANT) */
  @ApiProperty({
    description: 'Người gửi tin nhắn (user hoặc assistant)',
    required: true,
    enum: Sender
  })
  @IsEnum(Sender)
  sender: Sender = "user" as Sender;

  /** Nội dung tin nhắn dạng text */
  @ApiProperty({
    description: 'Nội dung tin nhắn dạng text',
    required: true,
    type: String
  })
  @IsString()
  @IsNotEmpty()
  message!: string;

  /** Danh sách sản phẩm gợi ý (chỉ dùng khi sender=assistant) */
  @ApiPropertyOptional({
    description: 'Danh sách sản phẩm gợi ý',
    type: [ProductCardOutputItemDto],
    nullable: true
  })
  @IsOptional()
  products?: ProductCardOutputItemDto[] | null;

  /** Danh sách sản phẩm tạm (chỉ dùng khi sender=assistant) */
  @ApiPropertyOptional({
    description: 'Danh sách sản phẩm tạm',
    type: [ProductTempItemDto],
    nullable: true
  })
  @IsOptional()
  productTemp?: ProductTempItemDto[] | null;

  /** Gợi ý câu hỏi tiếp theo (chỉ dùng khi sender=assistant) */
  @ApiPropertyOptional({
    description: 'Gợi ý 3-4 câu hỏi tiếp theo',
    type: [String],
    nullable: true
  })
  @IsOptional()
  suggestedQuestions?: string[] | null;

  /**
   * Chuyển đổi từ DTO sang Entity.
   * Nếu có structured data (products/suggestedQuestions), lưu dạng JSON string.
   * @returns Entity Message mới
   */
  toEntity(): Message {
    const entity = new Message();
    entity.sender = this.sender;

    const hasStructuredData =
      (this.products && this.products.length > 0) ||
      (this.suggestedQuestions && this.suggestedQuestions.length > 0) ||
      (this.productTemp && this.productTemp.length > 0);

    if (hasStructuredData) {
      entity.message = JSON.stringify({
        message: this.message,
        products: this.products ?? null,
        productTemp: this.productTemp ?? null,
        suggestedQuestions: this.suggestedQuestions ?? null
      });
    } else {
      entity.message = this.message;
    }

    return entity;
  }
}