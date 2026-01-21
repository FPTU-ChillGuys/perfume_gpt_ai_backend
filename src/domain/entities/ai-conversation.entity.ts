import { Collection } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { AIMessage } from './ai-message.entity';

export class AIConversation extends Common {
  userId!: string;
  messages = new Collection<AIMessage>(this);
}
