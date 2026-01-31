import { Sender } from '../enum/sender.enum';
import { Conversation } from './conversation.entity';
import { Common } from './common/common.entities';
import { Entity, Enum, ManyToOne, OneToOne, Property } from '@mikro-orm/core';
import { MessageResponse } from 'src/application/dtos/response/message.response';
import { ApiProperty } from '@nestjs/swagger';
import { UserLogDetail } from './ai-user-log-detail.entity';

@Entity({ repository: () => MessageResponse })
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

  @ApiProperty({ type: () => UserLogDetail })
  @OneToOne(() => UserLogDetail)
  UserLogDetail!: UserLogDetail;

  constructor(init?: Partial<Message>) {
    super();
    Object.assign(this, init);
  }
}
