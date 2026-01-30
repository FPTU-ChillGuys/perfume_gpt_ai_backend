import { Entity, Enum, Property } from '@mikro-orm/core';
import { RequestType } from '../enum/request-type.enum';
import { Common } from './common/common.entities';
import { AIRequestResponseRepository } from 'src/infrastructure/repositories/ai-request-response.repository';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ repository: () => AIRequestResponseRepository })
export class AIRequestResponse extends Common {

  @ApiProperty()
  @Property()
  userId!: string;

  @ApiProperty({ enum: RequestType })
  @Enum(() => RequestType)
  requestType!: RequestType;

  @ApiProperty()
  @Property()
  prompt!: string;

  @ApiProperty()
  @Property()
  response!: string;

  constructor(init?: Partial<AIRequestResponse>) {
    super();
    Object.assign(this, init);
  }
}
