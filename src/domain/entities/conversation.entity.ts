import { Collection } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { Message } from './message.entity';

export class Conversation extends Common {
  userId!: string;
  messages = new Collection<Message>(this);
}
