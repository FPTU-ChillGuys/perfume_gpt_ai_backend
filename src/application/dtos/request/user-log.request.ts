import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { endOfDay } from 'date-fns';
import { PeriodEnum } from 'src/domain/enum/period.enum';

/** Request lấy log hành vi người dùng theo khoảng thời gian */
export class UserLogRequest {
  /** ID người dùng */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  @IsUUID()
  userId: string;

  /** Khoảng thời gian lọc (weekly, monthly, yearly) */
  @ApiProperty({
    description: 'Khoảng thời gian lọc',
    enum: PeriodEnum,
    required: false
  })
  @IsOptional()
  @IsEnum(PeriodEnum)
  period: PeriodEnum = PeriodEnum.MONTHLY;

  /** Ngày kết thúc */
  @ApiProperty({ description: 'Ngày kết thúc', default: endOfDay(new Date()) })
  @IsDate()
  @Type(() => Date)
  endDate: Date = endOfDay(new Date());

  /** Ngày bắt đầu (tùy chọn) */
  @ApiProperty({ description: 'Ngày bắt đầu', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  constructor(init?: Partial<UserLogRequest>) {
    Object.assign(this, init);
  }
}

/** Request lấy log hành vi tất cả người dùng */
export class AllUserLogRequest {
  /** Khoảng thời gian lọc */
  @ApiProperty({
    description: 'Khoảng thời gian lọc',
    enum: PeriodEnum,
    required: false
  })
  @IsOptional()
  @IsEnum(PeriodEnum)
  period: PeriodEnum = PeriodEnum.MONTHLY;

  /** Ngày kết thúc */
  @ApiProperty({ description: 'Ngày kết thúc' })
  @IsDate()
  @Type(() => Date)
  endDate: Date = endOfDay(new Date());

  /** Ngày bắt đầu (tùy chọn) */
  @ApiProperty({ description: 'Ngày bắt đầu', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  constructor(init?: Partial<AllUserLogRequest>) {
    Object.assign(this, init);
  }
}

export class AllUserLogWithForceRefreshRequest extends AllUserLogRequest {
  /** Bắt buộc làm mới cache */
  @ApiProperty({ description: 'Bắt buộc làm mới cache', default: false })
  @IsOptional()
  forceRefresh: boolean = false;
}
