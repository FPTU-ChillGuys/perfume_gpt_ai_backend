import { Entity, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';

/** Entity lưu trữ chỉ thị của admin cho hệ thống AI */
@Entity()
export class AdminInstruction extends Common {

  /** Nội dung chỉ thị */
  @ApiProperty({ description: 'Nội dung chỉ thị của admin' })
  @Property()
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
