import { Sender } from '../enum/sender.enum';
import { Conversation } from './conversation.entity';
import { Common } from './common/common.entities';
import { Entity } from '@mikro-orm/core';
import { MessageResponse } from 'src/application/dtos/response/message.response';

@Entity({ repository: () => MessageResponse })
export class Message extends Common {
  conversationId!: string;
  sender!: Sender;
  message!: string;
  conversation!: Conversation;
}
