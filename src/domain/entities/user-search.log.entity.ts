import { ApiProperty } from '@nestjs/swagger';
import { Common } from './common/common.entities';
import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { UserLog } from './user-log.entity';

@Entity()
export class UserSearchLog extends Common {
  @ApiProperty({ type: 'string', nullable: true })
  @Property({ type: 'text', nullable: true })
  content?: string;

  @ApiProperty({ type: () => UserLog })
  @ManyToOne(() => UserLog)
  userLog: UserLog;

  constructor(init?: Partial<UserSearchLog>) {
    super();
    Object.assign(this, init);
  }
}
