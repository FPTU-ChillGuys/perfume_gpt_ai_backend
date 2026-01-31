import { ApiProperty } from '@nestjs/swagger';

export class MessageDto {
  @ApiProperty()
  sender!: string;
  @ApiProperty()
  message!: string;

  constructor(init?: Partial<MessageDto>) {
    Object.assign(this, init);
  }
}
