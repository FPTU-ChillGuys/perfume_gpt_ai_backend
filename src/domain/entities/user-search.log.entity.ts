import { ApiProperty } from '@nestjs/swagger';
import { Common } from './common/common.entities';
import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { UserLog } from './user-log.entity';

/** Entity lưu log tìm kiếm của người dùng */
@Entity()
export class UserSearchLog extends Common {
  /** Nội dung tìm kiếm */
  @ApiProperty({ description: 'Nội dung tìm kiếm', type: 'string', nullable: true })
  @Property({ type: 'text', nullable: true })
  content?: string;

  /** Bản ghi user log cha */
  @ApiProperty({ description: 'User log cha', type: () => UserLog })
  @ManyToOne(() => UserLog)
  userLog: UserLog;

  constructor(init?: Partial<UserSearchLog>) {
    super();
    Object.assign(this, init);
  }
}
