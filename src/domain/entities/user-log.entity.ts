import {
  Collection,
  Entity,
  Enum,
  ManyToOne,
  OneToMany,
  Property
} from '@mikro-orm/core';
import { RequestType } from '../enum/request-type.enum';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';
import { UserMessageLog } from './user-message-log.entity';
import { UserQuizLog } from './user-quiz-log.entity';
import { UserSearchLog } from './user-search.log.entity';

@Entity()
export class UserLog extends Common {
  @ApiProperty()
  @Property()
  userId!: string;

  @ApiProperty({type: () => UserMessageLog, isArray: true})
  @OneToMany(() => UserMessageLog, (userMessageLog) => userMessageLog.userLog)
  userMessageLogs = new Collection<UserMessageLog>(this);

  @ApiProperty({type: () => UserQuizLog, isArray: true})
  @OneToMany(() => UserQuizLog, (userQuizLog) => userQuizLog.userLog)
  userQuizLogs = new Collection<UserQuizLog>(this);

  @ApiProperty({type: () => UserSearchLog, isArray: true})
  @OneToMany(() => UserSearchLog, (userSearchLog) => userSearchLog.userLog)
  userSearchLogs = new Collection<UserSearchLog>(this);

  constructor(init?: Partial<UserLog>) {
    super();
    Object.assign(this, init);
  }
}
