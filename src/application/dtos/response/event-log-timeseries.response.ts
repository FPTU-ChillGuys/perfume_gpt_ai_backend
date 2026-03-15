import { ApiProperty } from '@nestjs/swagger';

export class EventLogTimeSeriesPointResponse {
  @ApiProperty({ description: 'Mốc thời gian của bucket' })
  bucketStart!: Date;

  @ApiProperty({ description: 'Tổng số event trong bucket' })
  totalCount!: number;

  @ApiProperty({ description: 'Số event message trong bucket' })
  messageCount!: number;

  @ApiProperty({ description: 'Số event search trong bucket' })
  searchCount!: number;

  @ApiProperty({ description: 'Số event quiz trong bucket' })
  quizCount!: number;
}

export class EventLogTimeSeriesResponse {
  @ApiProperty({ description: 'ID người dùng', nullable: true, required: false })
  userId?: string;

  @ApiProperty({ description: 'Ngày bắt đầu thống kê', nullable: true, required: false })
  startDate?: Date;

  @ApiProperty({ description: 'Ngày kết thúc thống kê', nullable: true, required: false })
  endDate?: Date;

  @ApiProperty({ description: 'Mức gộp dữ liệu', enum: ['day', 'week'] })
  granularity!: 'day' | 'week';

  @ApiProperty({ description: 'Các điểm dữ liệu time-series', type: [EventLogTimeSeriesPointResponse] })
  points!: EventLogTimeSeriesPointResponse[];
}
