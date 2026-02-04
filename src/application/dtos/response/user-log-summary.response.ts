import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';

export class UserLogSummaryResponse extends CommonResponse {
  @ApiProperty()
  userId: string;
  @ApiProperty()
  startDate: Date;
  @ApiProperty()
  endDate: Date;
  @ApiProperty()
  logSummary: string;

  constructor(init?: Partial<UserLogSummaryResponse>) {
    super();
    Object.assign(this, init);
  }
}
