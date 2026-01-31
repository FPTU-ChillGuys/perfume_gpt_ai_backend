import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';
import { UserMessageLogResponse } from './user-message-log.response';
import { UserQuizLogResponse } from './user-quiz-log.response';
import { UserSearchLogResponse } from './user-search-log.response';

export class UserLogResponse extends CommonResponse {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  userMessageLogs!: UserMessageLogResponse[];

  @ApiProperty()
  userQuizLogs!: UserQuizLogResponse[];

  @ApiProperty()
  userSearchLogs!: UserSearchLogResponse[]

}
