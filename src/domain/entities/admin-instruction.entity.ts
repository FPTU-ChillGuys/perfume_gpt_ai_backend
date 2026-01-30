import { Entity, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class AdminInstruction extends Common {

  @ApiProperty()
  @Property()
  instruction!: string;

  @ApiProperty()
  @Property()
  instructionType!: string;

  constructor(init?: Partial<AdminInstruction>) {
    super();
    Object.assign(this, init);
  }
}
