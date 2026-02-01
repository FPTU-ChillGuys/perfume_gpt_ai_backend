import { ApiProperty } from '@nestjs/swagger';
import { PeriodEnum } from 'src/domain/enum/period.enum';

export class UserLogRequest {
  @ApiProperty()
  userId: string;
  @ApiProperty({ enum: PeriodEnum })
  period: PeriodEnum;
  @ApiProperty()
  endDate: Date;
  @ApiProperty()
  startDate?: Date;
}
