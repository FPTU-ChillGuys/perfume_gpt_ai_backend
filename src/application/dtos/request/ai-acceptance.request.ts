import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { AIAcceptanceSourceType } from 'src/domain/enum/ai-acceptance-source-type.enum';
import { IsEnum } from 'class-validator';

/** Request tạo hoặc cập nhật trạng thái chấp nhận AI */
export class AIAcceptanceRequest {
  /** ID người dùng */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  @IsUUID()
  userId: string;

  /** Trạng thái chấp nhận AI */
  @ApiProperty({ description: 'Người dùng có chấp nhận đề xuất AI hay không' })
  @IsBoolean()
  isAccepted: boolean;

  /** Nguồn phát sinh acceptance */
  @ApiProperty({
    description: 'Nguồn phát sinh acceptance',
    enum: AIAcceptanceSourceType
  })
  @IsEnum(AIAcceptanceSourceType)
  sourceType: AIAcceptanceSourceType;

  /** ID thực thể theo source type (tùy chọn) */
  @ApiProperty({ description: 'ID thực thể theo source type', required: false, nullable: true })
  @IsOptional()
  @IsString()
  sourceId?: string | null;

  constructor(init?: Partial<AIAcceptanceRequest>) {
    Object.assign(this, init);
  }
}
