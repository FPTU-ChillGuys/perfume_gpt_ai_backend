import { Entity, Enum, Property } from '@mikro-orm/core';
import { RequestType } from '../enum/request-type.enum';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class AIUserLog extends Common {

  @ApiProperty()
  @Property()
  userId!: string;

  @ApiProperty({ enum: RequestType })
  @Enum(() => RequestType)
  requestType!: RequestType;

  // @ApiProperty()
  // @Property()
  // prompt!: string;

  // @ApiProperty()
  // @Property()
  // response!: string;

  constructor(init?: Partial<AIUserLog>) {
    super();
    Object.assign(this, init);
  }
}
