import { Entity, Enum, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';
import { PeriodEnum } from '../enum/period.enum';
import { UserLogSummaryRepository } from 'src/infrastructure/repositories/user-log-summary.repository';

/** Entity lưu bản tóm tắt hành vi người dùng theo khoảng thời gian */
@Entity({repository: () => UserLogSummaryRepository})
export class UserLogSummary extends Common {
  
  /** ID người dùng */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  @Property()
  userId!: string;

  /** Ngày bắt đầu khoảng thời gian tóm tắt */
  @ApiProperty({ description: 'Ngày bắt đầu' })
  @Property()
  startDate!: Date;

  /** Ngày kết thúc khoảng thời gian tóm tắt */
  @ApiProperty({ description: 'Ngày kết thúc' })
  @Property()
  endDate!: Date;

  /** Nội dung tóm tắt hành vi người dùng */
  @ApiProperty({ description: 'Nội dung tóm tắt log', type: 'string' })
  @Property({ type: 'text' })
  logSummary!: string;

  constructor(init?: Partial<UserLogSummary>) {
    super();
    Object.assign(this, init);
  }
}
