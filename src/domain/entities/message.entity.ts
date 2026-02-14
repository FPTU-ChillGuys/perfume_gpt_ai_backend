import { Sender } from '../enum/sender.enum';
import { Conversation } from './conversation.entity';
import { Common } from './common/common.entities';
import { Entity, Enum, ManyToOne, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { UserMessageLog } from './user-message-log.entity';

/** Entity lưu tin nhắn trong cuộc hội thoại */
@Entity()
export class Message extends Common {
  /** Người gửi tin nhắn (USER hoặc ASSISTANT) */
  @ApiProperty({ description: 'Người gửi tin nhắn', enum: Sender })
  @Enum(() => Sender)
  sender!: Sender;

  /** Nội dung tin nhắn */
  @ApiProperty({ description: 'Nội dung tin nhắn', type: 'string' })
  @Property({ type: 'text' })
  message!: string;

  /** Cuộc hội thoại chứa tin nhắn này */
  @ApiProperty({ description: 'Cuộc hội thoại liên quan', type: () => Conversation })
  @ManyToOne(() => Conversation, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  conversation!: Conversation;

  /** Log tin nhắn của người dùng (nếu có) */
  @ApiProperty({ description: 'Log tin nhắn của người dùng', type: () => UserMessageLog, nullable: true })
  @ManyToOne(() => UserMessageLog, { nullable: true })
  userMessageLog?: UserMessageLog;

  constructor(init?: Partial<Message>) {
    super();
    Object.assign(this, init);
  }
}
