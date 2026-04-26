import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { AdminInstruction } from 'src/domain/entities/admin-instruction.entity';
import { ALL_INSTRUCTION_TYPES } from 'src/application/constant/prompts/admin-instruction-types';

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
    enum: ALL_INSTRUCTION_TYPES
  })
  @IsString()
  @IsIn(ALL_INSTRUCTION_TYPES, {
    message: `instructionType phải là một trong: ${ALL_INSTRUCTION_TYPES.join(', ')}`
  })
  instructionType: string;

  constructor(init?: Partial<CreateAdminInstructionRequest>) {
    Object.assign(this, init);
  }

  /** Tạo Entity từ Request DTO (không bao gồm ID vì là tạo mới) */
  toEntity(): Partial<AdminInstruction> {
    return {
      instruction: this.instruction,
      instructionType: this.instructionType
    };
  }
}
