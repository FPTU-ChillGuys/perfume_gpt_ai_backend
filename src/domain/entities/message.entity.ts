import { Sender } from '../enum/sender.enum';
import { Conversation } from './conversation.entity';
import { Common } from './common/common.entities';
import { Entity, Enum, ManyToOne, OneToOne, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { UserMessageLog } from './user-message-log.entity';

@Entity()
export class Message extends Common {
  @ApiProperty({ enum: Sender })
  @Enum(() => Sender)
  sender!: Sender;

  @ApiProperty()
  @Property()
  message!: string;

  @ApiProperty({ type: () => Conversation })
  @ManyToOne(() => Conversation, {
    deleteRule: 'cascade',
    updateRule: 'cascade'
  })
  conversation!: Conversation;

  @ApiProperty({ type: () => UserMessageLog })
  @OneToOne(() => UserMessageLog)
  userMessageLog!: UserMessageLog;

  constructor(init?: Partial<Message>) {
    super();
    Object.assign(this, init);
  }
}
