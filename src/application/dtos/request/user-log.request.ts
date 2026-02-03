import { ApiProperty } from '@nestjs/swagger';
import { endOfDay } from 'date-fns';
import { PeriodEnum } from 'src/domain/enum/period.enum';

export class UserLogRequest {
  @ApiProperty()
  userId: string;
  @ApiProperty({ enum: PeriodEnum })
  period: PeriodEnum;
  @ApiProperty({ default: endOfDay(new Date()) })
  endDate: Date = endOfDay(new Date());
  @ApiProperty()
  startDate?: Date;
}

export class AllUserLogRequest {
  @ApiProperty({ enum: PeriodEnum })
  period: PeriodEnum;
  @ApiProperty()
  endDate: Date;
  @ApiProperty()
  startDate?: Date;
}
