import { Sender } from 'src/domain/enum/sender.enum';
import { CommonResponse } from './common/common.response';
import { ApiProperty } from '@nestjs/swagger';

export class MessageResponse extends CommonResponse {
  @ApiProperty()
  sender!: Sender;
  @ApiProperty()
  message!: string;

  constructor(init?: Partial<MessageResponse>) {
    super();
    Object.assign(this, init);
  }
}
