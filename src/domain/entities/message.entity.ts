import { Sender } from '../enum/sender.enum';
import { Conversation } from './conversation.entity';
import { Common } from './common/common.entities';
import { Entity, Enum, ManyToOne, Property } from '@mikro-orm/core';
import { MessageResponse } from 'src/application/dtos/response/message.response';

@Entity({ repository: () => MessageResponse })
export class Message extends Common {
  @Enum(() => Sender)
  sender!: Sender;
  @Property()
  message!: string;
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
