import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Request tạo chỉ thị admin mới */
export class CreateAdminInstructionRequest {
  /** Nội dung chỉ thị */
  @ApiProperty({ description: 'Nội dung chỉ thị của admin' })
  instruction: string;

  /** Loại chỉ thị (ví dụ: system, prompt, rule) */
  @ApiProperty({ description: 'Loại chỉ thị (system | prompt | rule)' })
  instructionType: string;

  constructor(init?: Partial<CreateAdminInstructionRequest>) {
    Object.assign(this, init);
  }
}

/** Request cập nhật chỉ thị admin */
export class UpdateAdminInstructionRequest {
  /** Nội dung chỉ thị (tùy chọn) */
  @ApiPropertyOptional({ description: 'Nội dung chỉ thị mới' })
  instruction?: string;

  /** Loại chỉ thị (tùy chọn) */
  @ApiPropertyOptional({ description: 'Loại chỉ thị mới' })
  instructionType?: string;

  constructor(init?: Partial<UpdateAdminInstructionRequest>) {
    Object.assign(this, init);
  }
}
