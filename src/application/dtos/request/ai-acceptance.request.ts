import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

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

  /** ID cart item liên quan (tùy chọn) */
  @ApiProperty({ description: 'ID cart item nếu có liên quan', required: false, nullable: true })
  @IsOptional()
  @IsString()
  cartItemId?: string | null;

  constructor(init?: Partial<AIAcceptanceRequest>) {
    Object.assign(this, init);
  }
}
