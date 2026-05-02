import { Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { Message } from './message.entity';
import { ConversationRepository } from 'src/infrastructure/domain/repositories/conversation.repository';
import { ApiProperty } from '@nestjs/swagger';

/** Entity lưu cuộc hội thoại giữa người dùng và AI */
@Entity({ repository: () => ConversationRepository })
export class Conversation extends Common {
  /** ID người dùng sở hữu cuộc hội thoại */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  @Property()
  userId!: string;

  /** Danh sách tin nhắn trong cuộc hội thoại */
  @ApiProperty({
    description: 'Danh sách tin nhắn',
    type: () => Message,
    isArray: true
  })
  @OneToMany(() => Message, (message) => message.conversation, {
    orphanRemoval: true
  })
  messages = new Collection<Message>(this);

  constructor(init?: Partial<Conversation>) {
    super();
    Object.assign(this, init);
  }
}
