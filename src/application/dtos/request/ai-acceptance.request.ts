import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min
} from 'class-validator';
import {
  AI_ACCEPTANCE_CONTEXTS,
  AIAcceptanceContextType
} from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.constants';

/** Request tạo hoặc cập nhật trạng thái chấp nhận AI */
export class AIAcceptanceRequest {
  /** Trạng thái chấp nhận AI */
  @ApiProperty({ description: 'Người dùng có chấp nhận đề xuất AI hay không' })
  @IsBoolean()
  isAccepted: boolean;

  constructor(init?: Partial<AIAcceptanceRequest>) {
    Object.assign(this, init);
  }
}

export class CreateResponseAIAcceptanceRequest {
  @ApiProperty({
    description: 'Ngữ cảnh phát sinh AI acceptance',
    enum: AI_ACCEPTANCE_CONTEXTS
  })
  @IsString()
  @IsIn(AI_ACCEPTANCE_CONTEXTS)
  contextType!: AIAcceptanceContextType;

  @ApiProperty({
    description: 'Mã tham chiếu nguồn (conversationId/surveyId/...)',
    required: false
  })
  @IsOptional()
  @IsString()
  sourceRefId?: string;

  @ApiProperty({
    description: 'Danh sách id sản phẩm trong response',
    type: [String],
    required: false
  })
  @IsOptional()
  @IsArray()
  productIds?: string[];

  @ApiProperty({
    description: 'Số giờ delay trước khi false được xem là no-click',
    required: false,
    default: 24
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  visibleInHours?: number;

  @ApiProperty({ description: 'Metadata mở rộng', required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  constructor(init?: Partial<CreateResponseAIAcceptanceRequest>) {
    Object.assign(this, init);
  }
}
