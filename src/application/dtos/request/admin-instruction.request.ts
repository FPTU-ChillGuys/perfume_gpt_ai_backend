import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const VALID_INSTRUCTION_TYPES = [
  'review', 'order', 'inventory', 'trend',
  'recommendation', 'log', 'conversation'
] as const;

/** Request tạo chỉ thị admin mới */
export class CreateAdminInstructionRequest {
  /** Nội dung chỉ thị */
  @ApiProperty({ description: 'Nội dung chỉ thị của admin' })
  @IsString()
  @IsNotEmpty()
  instruction: string;

  /** Loại chỉ thị */
  @ApiProperty({
    description: 'Loại chỉ thị',
    enum: VALID_INSTRUCTION_TYPES
  })
  @IsString()
  @IsIn(VALID_INSTRUCTION_TYPES, {
    message: `instructionType phải là một trong: ${VALID_INSTRUCTION_TYPES.join(', ')}`
  })
  instructionType: string;

  constructor(init?: Partial<CreateAdminInstructionRequest>) {
    Object.assign(this, init);
  }
}

/** Request cập nhật chỉ thị admin */
export class UpdateAdminInstructionRequest {
  /** Nội dung chỉ thị (tùy chọn) */
  @ApiPropertyOptional({ description: 'Nội dung chỉ thị mới' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  instruction?: string;

  /** Loại chỉ thị (tùy chọn) */
  @ApiPropertyOptional({
    description: 'Loại chỉ thị mới',
    enum: VALID_INSTRUCTION_TYPES
  })
  @IsOptional()
  @IsString()
  @IsIn(VALID_INSTRUCTION_TYPES, {
    message: `instructionType phải là một trong: ${VALID_INSTRUCTION_TYPES.join(', ')}`
  })
  instructionType?: string;

  constructor(init?: Partial<UpdateAdminInstructionRequest>) {
    Object.assign(this, init);
  }
}
