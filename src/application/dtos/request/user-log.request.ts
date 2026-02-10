import { ApiProperty } from '@nestjs/swagger';
import { endOfDay } from 'date-fns';
import { PeriodEnum } from 'src/domain/enum/period.enum';

/** Request lấy log hành vi người dùng theo khoảng thời gian */
export class UserLogRequest {
  /** ID người dùng */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  userId: string;

  /** Khoảng thời gian lọc (weekly, monthly, yearly) */
  @ApiProperty({ description: 'Khoảng thời gian lọc', enum: PeriodEnum })
  period: PeriodEnum;

  /** Ngày kết thúc */
  @ApiProperty({ description: 'Ngày kết thúc', default: endOfDay(new Date()) })
  endDate: Date = endOfDay(new Date());

  /** Ngày bắt đầu (tùy chọn) */
  @ApiProperty({ description: 'Ngày bắt đầu', required: false })
  startDate?: Date;

  constructor(init ?: Partial<UserLogRequest>) {
    Object.assign(this, init);
  }
}

/** Request lấy log hành vi tất cả người dùng */
export class AllUserLogRequest {
  /** Khoảng thời gian lọc */
  @ApiProperty({ description: 'Khoảng thời gian lọc', enum: PeriodEnum })
  period: PeriodEnum;

  /** Ngày kết thúc */
  @ApiProperty({ description: 'Ngày kết thúc' })
  endDate: Date;

  /** Ngày bắt đầu (tùy chọn) */
  @ApiProperty({ description: 'Ngày bắt đầu', required: false })
  startDate?: Date;

  constructor(init ?: Partial<AllUserLogRequest>) {
    Object.assign(this, init);
  }
}
