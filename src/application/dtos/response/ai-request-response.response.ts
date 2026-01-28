import { RequestType } from 'src/domain/enum/request-type.enum';
import { CommonResponse } from './common/common.response';
import { ApiProperty } from '@nestjs/swagger';

export class AIReqResResponse extends CommonResponse {
  @ApiProperty()
  userId!: string;
  @ApiProperty()
  requestType!: RequestType;
  @ApiProperty()
  prompt!: string;
  @ApiProperty()
  response!: string;

  constructor(init?: Partial<AIReqResResponse>) {
    super();
    Object.assign(this, init);
  }
}
