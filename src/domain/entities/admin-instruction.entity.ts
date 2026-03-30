import { Entity, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';
import { AdminInstructionRepository } from 'src/infrastructure/domain/repositories/admin-instruction.repository';

/** Entity lưu trữ chỉ thị của admin cho hệ thống AI */
@Entity({repository : () => AdminInstructionRepository})
export class AdminInstruction extends Common {

  /** Nội dung chỉ thị */
  @ApiProperty({ description: 'Nội dung chỉ thị của admin' })
  @Property({ type: 'text' })
  instruction!: string;

  /** Loại chỉ thị (ví dụ: system, prompt, rule) */
  @ApiProperty({ description: 'Loại chỉ thị' })
  @Property()
  instructionType!: string;

  constructor(init?: Partial<AdminInstruction>) {
    super();
    Object.assign(this, init);
  }
}
