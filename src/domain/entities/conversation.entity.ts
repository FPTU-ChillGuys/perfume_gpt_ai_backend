import { Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { Message } from './message.entity';
import { ConversationRepository } from 'src/infrastructure/repositories/conversation.repository';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ repository: () => ConversationRepository })
export class Conversation extends Common {
  @ApiProperty()
  @Property()
  userId!: string;

  @ApiProperty()
  @OneToMany(() => Message, (message) => message.conversation)
  messages = new Collection<Message>(this);

  constructor(init?: Partial<Conversation>) {
    super();
    Object.assign(this, init);
  }
}
