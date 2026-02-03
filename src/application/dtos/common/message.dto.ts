import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from '../response/common/common.response';
import { Sender } from 'src/domain/enum/sender.enum';

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

export class MessageRequestDto {
  @ApiProperty()
  sender!: Sender;
  @ApiProperty()
  message!: string;

  constructor(init?: Partial<MessageRequestDto>) {
    Object.assign(this, init);
  }
}
