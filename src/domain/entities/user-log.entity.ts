import { Entity, Enum, Property } from '@mikro-orm/core';
import { RequestType } from '../enum/request-type.enum';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class UserLog extends Common {

  @ApiProperty()
  @Property()
  userId!: string;

  constructor(init?: Partial<UserLog>) {
    super();
    Object.assign(this, init);
  }
}
