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

@Entity({repository: () => UserLogRepository})
export class UserLog extends Common {
  @ApiProperty({ type: 'string', nullable: true })
  @Property({ type: 'text', nullable: true })
  userId?: string;

  @ApiProperty({type: () => UserMessageLog, isArray: true, nullable: true })
  @OneToMany(() => UserMessageLog, (userMessageLog) => userMessageLog.userLog, { nullable: true })
  userMessageLogs = new Collection<UserMessageLog>(this);

  @ApiProperty({type: () => UserQuizLog, isArray: true, nullable: true })
  @OneToMany(() => UserQuizLog, (userQuizLog) => userQuizLog.userLog, { nullable: true })
  userQuizLogs = new Collection<UserQuizLog>(this);

  @ApiProperty({type: () => UserSearchLog, isArray: true, nullable: true })
  @OneToMany(() => UserSearchLog, (userSearchLog) => userSearchLog.userLog, { nullable: true })
  userSearchLogs = new Collection<UserSearchLog>(this);

  constructor(init?: Partial<UserLog>) {
    super();
    Object.assign(this, init);
  }
}
