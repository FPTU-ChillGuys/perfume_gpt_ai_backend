import { Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';

export class AIAcceptance extends BaseResponse {
  @ApiProperty()
  @Property()
  userId: string;

  @ApiProperty()
  @Property()
  isAccepted: boolean;

  constructor(init?: Partial<AIAcceptance>) {
    super();
    Object.assign(this, init);
  }
}
