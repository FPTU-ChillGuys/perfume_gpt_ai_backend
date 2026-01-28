import { ApiProperty } from '@nestjs/swagger';
import { MessageDto } from './message.dto';

export class ConversationDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  userId?: string;
  @ApiProperty()
  messages?: MessageDto[];
}
