import { Entity, Enum, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';
import { PeriodEnum } from '../enum/period.enum';

@Entity()
export class UserLogSummary extends Common {
  
  @ApiProperty()
  @Property()
  userId!: string;

  @ApiProperty()
  @Enum(() => PeriodEnum)
  period!: PeriodEnum;

  @ApiProperty()
  @Property()
  startDate!: Date;

  @ApiProperty()
  @Property()
  endDate!: Date;

  @ApiProperty()
  @Property()
  totalLogs!: number;

  @ApiProperty()
  @Property()
  logSummary!: string;

  constructor(init?: Partial<UserLogSummary>) {
    super();
    Object.assign(this, init);
  }
}
