import { Sender } from '../enum/sender.enum';
import { Common } from './common/common.entities';

export class AIMessage extends Common {
  conversationId!: string;
  sender!: Sender;
  message!: string;
}
