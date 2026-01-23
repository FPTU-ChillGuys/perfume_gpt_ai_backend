import { Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';

export class AdminInstruction extends Common {
  @Property()
  instruction!: string;
  @Property()
  instructionType!: string;
}
