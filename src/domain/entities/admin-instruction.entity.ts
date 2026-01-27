import { Entity, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';

@Entity()
export class AdminInstruction extends Common {
  @Property()
  instruction!: string;
  @Property()
  instructionType!: string;

  constructor(init?: Partial<AdminInstruction>) {
    super();
    Object.assign(this, init);
  }
}
