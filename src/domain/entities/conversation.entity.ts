import { Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { Message } from './message.entity';
import { ConversationRepository } from 'src/infrastructure/repositories/conversation.repository';

@Entity({ repository: () => ConversationRepository })
export class Conversation extends Common {
  @Property()
  userId!: string;
  @OneToMany(() => Message, (message) => message.conversation)
  messages = new Collection<Message>(this);

  constructor(init?: Partial<Conversation>) {
    super();
    Object.assign(this, init);
  }
}
