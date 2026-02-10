import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';
import { UserMessageLogResponse } from './user-message-log.response';
import { UserQuizLogResponse } from './user-quiz-log.response';
import { UserSearchLogResponse } from './user-search-log.response';

/** Response log hành vi người dùng */
export class UserLogResponse extends CommonResponse {
  /** ID người dùng */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  userId!: string;

  /** Danh sách log tin nhắn */
  @ApiProperty({ description: 'Danh sách log tin nhắn', type: [UserMessageLogResponse] })
  userMessageLogs!: UserMessageLogResponse[];

  /** Danh sách log quiz */
  @ApiProperty({ description: 'Danh sách log quiz', type: [UserQuizLogResponse] })
  userQuizLogs!: UserQuizLogResponse[];

  /** Danh sách log tìm kiếm */
  @ApiProperty({ description: 'Danh sách log tìm kiếm', type: [UserSearchLogResponse] })
  userSearchLogs!: UserSearchLogResponse[]

}
