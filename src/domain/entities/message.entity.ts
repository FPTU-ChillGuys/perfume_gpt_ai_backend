import { Sender } from '../enum/sender.enum';
import { Conversation } from './conversation.entity';
import { Common } from './common/common.entities';
import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { MessageResponse } from 'src/application/dtos/response/message.response';

@Entity({ repository: () => MessageResponse })
export class Message extends Common {
  @Property()
  conversationId!: string;
  @Property()
  sender!: Sender;
  @Property()
  message!: string;
  @ManyToOne(() => Conversation, {
    fieldName: 'conversationId',
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  conversation!: Conversation;
}
