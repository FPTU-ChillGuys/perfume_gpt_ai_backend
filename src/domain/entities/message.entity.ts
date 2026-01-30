import { Sender } from '../enum/sender.enum';
import { Conversation } from './conversation.entity';
import { Common } from './common/common.entities';
import { Entity, Enum, ManyToOne, Property } from '@mikro-orm/core';
import { MessageResponse } from 'src/application/dtos/response/message.response';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ repository: () => MessageResponse })
export class Message extends Common {
  @ApiProperty()
  @Enum(() => Sender)
  sender!: Sender;

  @ApiProperty()
  @Property()
  message!: string;
  
  @ApiProperty()
  @ManyToOne(() => Conversation, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  conversation!: Conversation;

  constructor(init?: Partial<Message>) {
    super();
    Object.assign(this, init);
  }
}
