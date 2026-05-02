import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf
} from 'class-validator';
import { PagedAndSortedRequest } from './paged-and-sorted.request';
import { EventLogEntityType } from 'src/domain/enum/event-log-entity-type.enum';
import { EventLogEventType } from 'src/domain/enum/event-log-event-type.enum';

export class EventLogQueryRequest {
  @ApiProperty({
    description: 'ID người dùng',
    required: false,
    nullable: true
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({
    description: 'Loại event',
    required: false,
    enum: EventLogEventType
  })
  @IsOptional()
  @IsEnum(EventLogEventType)
  eventType?: EventLogEventType;

  @ApiProperty({ description: 'Ngày bắt đầu lọc', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiProperty({ description: 'Ngày kết thúc lọc', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;
}

export class EventLogPagedQueryRequest extends PagedAndSortedRequest {
  @ApiProperty({
    description: 'ID người dùng',
    required: false,
    nullable: true
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({
    description: 'Loại event',
    required: false,
    enum: EventLogEventType
  })
  @IsOptional()
  @IsEnum(EventLogEventType)
  eventType?: EventLogEventType;

  @ApiProperty({ description: 'Ngày bắt đầu lọc', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiProperty({ description: 'Ngày kết thúc lọc', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;
}

export class EventLogCreateRequest {
  @ApiProperty({
    description: 'ID người dùng',
    required: false,
    nullable: true
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: 'Loại event', enum: EventLogEventType })
  @IsEnum(EventLogEventType)
  eventType!: EventLogEventType;

  @ApiProperty({ description: 'Loại thực thể', enum: EventLogEntityType })
  @IsEnum(EventLogEntityType)
  entityType!: EventLogEntityType;

  @ApiProperty({
    description: 'ID thực thể liên quan',
    required: false,
    nullable: true
  })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiProperty({
    description: 'Text payload cho message/search',
    required: false,
    nullable: true
  })
  @ValidateIf((obj) => obj.eventType !== EventLogEventType.SURVEY)
  @IsOptional()
  @IsString()
  contentText?: string;

  @ApiProperty({
    description: 'Metadata JSONB cho survey/extra',
    required: false,
    nullable: true,
    type: Object
  })
  @ValidateIf(
    (obj) =>
      obj.eventType === EventLogEventType.SURVEY || obj.metadata !== undefined
  )
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class EventLogSummaryQueryRequest {
  @ApiProperty({
    description: 'ID người dùng',
    required: false,
    nullable: true
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: 'Ngày bắt đầu lọc', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiProperty({ description: 'Ngày kết thúc lọc', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiProperty({
    description: 'Mức gộp thống kê cho biểu đồ',
    required: false,
    enum: ['day', 'week'],
    default: 'day'
  })
  @IsOptional()
  @IsEnum(['day', 'week'])
  granularity?: 'day' | 'week' = 'day';
}
