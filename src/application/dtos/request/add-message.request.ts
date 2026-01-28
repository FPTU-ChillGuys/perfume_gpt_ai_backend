import { ApiProperty } from '@nestjs/swagger';
import { Sender } from 'src/domain/enum/sender.enum';

export class AddMessageRequest {
  @ApiProperty()
  sender!: Sender;
  @ApiProperty()
  message!: string;
}
