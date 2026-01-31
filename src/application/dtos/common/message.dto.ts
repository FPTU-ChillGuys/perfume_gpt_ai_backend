import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from '../response/common/common.response';

export class MessageDto extends CommonResponse {
  @ApiProperty()
  sender!: string;
  @ApiProperty()
  message!: string;

  constructor(init?: Partial<MessageDto>) {
    super();
    Object.assign(this, init);
  }
}
