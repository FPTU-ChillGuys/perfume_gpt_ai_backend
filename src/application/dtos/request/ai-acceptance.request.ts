import { ApiProperty } from '@nestjs/swagger';

/** Request tạo hoặc cập nhật trạng thái chấp nhận AI */
export class AIAcceptanceRequest {
  /** ID người dùng */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  userId: string;

  /** Trạng thái chấp nhận AI */
  @ApiProperty({ description: 'Người dùng có chấp nhận đề xuất AI hay không' })
  isAccepted: boolean;

  constructor(init?: Partial<AIAcceptanceRequest>) {
    Object.assign(this, init);
  }
}
