import {
  Collection,
  Entity,
  Enum,
  ManyToOne,
  OneToMany,
  Property
} from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';
import { UserMessageLog } from './user-message-log.entity';
import { UserQuizLog } from './user-quiz-log.entity';
import { UserSearchLog } from './user-search.log.entity';
import { UserLogRepository } from 'src/infrastructure/repositories/user-log.repository';

/** Entity lưu log hành vi người dùng (tin nhắn, quiz, tìm kiếm) */
@Entity({repository: () => UserLogRepository})
export class UserLog extends Common {
  /** ID người dùng (có thể null cho log ẩn danh) */
  @ApiProperty({ description: 'ID người dùng', type: 'string', nullable: true })
  @Property({ type: 'text', nullable: true })
  userId?: string;

  /** Danh sách log tin nhắn của người dùng */
  @ApiProperty({ description: 'Log tin nhắn', type: () => UserMessageLog, isArray: true, nullable: true })
  @OneToMany(() => UserMessageLog, (userMessageLog) => userMessageLog.userLog, { nullable: true, orphanRemoval: true })
  userMessageLogs = new Collection<UserMessageLog>(this);

  /** Danh sách log quiz của người dùng */
  @ApiProperty({ description: 'Log quiz', type: () => UserQuizLog, isArray: true, nullable: true })
  @OneToMany(() => UserQuizLog, (userQuizLog) => userQuizLog.userLog, { nullable: true, orphanRemoval: true })
  userQuizLogs = new Collection<UserQuizLog>(this);

  /** Danh sách log tìm kiếm của người dùng */
  @ApiProperty({ description: 'Log tìm kiếm', type: () => UserSearchLog, isArray: true, nullable: true })
  @OneToMany(() => UserSearchLog, (userSearchLog) => userSearchLog.userLog, { nullable: true, orphanRemoval: true })
  userSearchLogs = new Collection<UserSearchLog>(this);

  constructor(init?: Partial<UserLog>) {
    super();
    Object.assign(this, init);
  }
}
