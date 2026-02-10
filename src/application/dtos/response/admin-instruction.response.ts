import { ApiProperty } from '@nestjs/swagger';

/** Response chỉ thị admin */
export class AdminInstructionResponse {
  /** ID bản ghi */
  @ApiProperty({ description: 'ID bản ghi', format: 'uuid' })
  id: string;

  /** Nội dung chỉ thị */
  @ApiProperty({ description: 'Nội dung chỉ thị' })
  instruction: string;

  /** Loại chỉ thị */
  @ApiProperty({ description: 'Loại chỉ thị (system | prompt | rule)' })
  instructionType: string;

  /** Ngày tạo */
  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  /** Ngày cập nhật */
  @ApiProperty({ description: 'Ngày cập nhật' })
  updatedAt: Date;

  constructor(init?: Partial<AdminInstructionResponse>) {
    Object.assign(this, init);
  }
}
