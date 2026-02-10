import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';

/** Response tóm tắt log người dùng */
export class UserLogSummaryResponse extends CommonResponse {
  /** ID người dùng */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  userId: string;

  /** Ngày bắt đầu khoảng thời gian */
  @ApiProperty({ description: 'Ngày bắt đầu' })
  startDate: Date;

  /** Ngày kết thúc khoảng thời gian */
  @ApiProperty({ description: 'Ngày kết thúc' })
  endDate: Date;

  /** Nội dung tóm tắt log */
  @ApiProperty({ description: 'Nội dung tóm tắt log' })
  logSummary: string;

  constructor(init?: Partial<UserLogSummaryResponse>) {
    super();
    Object.assign(this, init);
  }
}
