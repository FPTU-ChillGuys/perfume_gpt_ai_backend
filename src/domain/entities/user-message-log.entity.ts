import { Collection, Entity, ManyToOne, OneToMany } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { Common } from './common/common.entities';
import { Message } from './message.entity';
import { UserLog } from './user-log.entity';

/** Entity lưu log tin nhắn của người dùng - liên kết Message với UserLog */
@Entity()
export class UserMessageLog extends Common {
  /** Tin nhắn được ghi log (nếu có) */
  @ApiProperty({ description: 'Tin nhắn được ghi log', type: () => Message, nullable: true })
  @OneToMany(() => Message, message => message.userMessageLog)
  message? = new Collection<Message>(this);

  /** Bản ghi user log cha */
  @ApiProperty({ description: 'User log cha', type: () => UserLog })
  @ManyToOne(() => UserLog)
  userLog: UserLog;

  constructor(init?: Partial<UserMessageLog>) {
    super();
    Object.assign(this, init);
  }
}
