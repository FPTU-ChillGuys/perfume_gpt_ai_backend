import { Sender } from '../enum/sender.enum';
import { Conversation } from './conversation.entity';
import { Common } from './common/common.entities';

export class Message extends Common {
  conversationId!: string;
  sender!: Sender;
  message!: string;
  conversation!: Conversation;
}
