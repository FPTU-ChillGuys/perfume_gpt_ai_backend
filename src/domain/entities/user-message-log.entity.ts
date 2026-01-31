import { Entity, OneToOne, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { Common } from './common/common.entities';
import { Message } from './message.entity';

@Entity()
export class UserMessageLog extends Common {
  @ApiProperty({ type: () => Message })
  @OneToOne(() => Message)
  message: Message;

  constructor(init?: Partial<UserMessageLog>) {
    super();
    Object.assign(this, init);
  }
}
