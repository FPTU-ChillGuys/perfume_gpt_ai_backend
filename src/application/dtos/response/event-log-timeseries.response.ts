import { ApiProperty } from '@nestjs/swagger';

export class EventLogTimeSeriesPointResponse {
  @ApiProperty({ description: 'Mốc thời gian của bucket' })
  bucketStart!: Date;

  @ApiProperty({ description: 'Tổng số event trong bucket' })
  totalCount!: number;

  @ApiProperty({ description: 'Số sự kiện tin nhắn trong bucket' })
  messageCount!: number;

  @ApiProperty({ description: 'Số sự kiện tìm kiếm trong bucket' })
  searchCount!: number;

  @ApiProperty({ description: 'Số sự kiện khảo sát trong bucket' })
  surveyCount!: number;

  @ApiProperty({ description: 'Số sự kiện sản phẩm trong bucket' })
  productCount!: number;
}

export class EventLogTimeSeriesResponse {
  @ApiProperty({
    description: 'ID người dùng',
    nullable: true,
    required: false
  })
  userId?: string;

  @ApiProperty({
    description: 'Ngày bắt đầu thống kê',
    nullable: true,
    required: false
  })
  startDate?: Date;

  @ApiProperty({
    description: 'Ngày kết thúc thống kê',
    nullable: true,
    required: false
  })
  endDate?: Date;

  @ApiProperty({ description: 'Mức gộp dữ liệu', enum: ['day', 'week'] })
  granularity!: 'day' | 'week';

  @ApiProperty({
    description: 'Các điểm dữ liệu time-series',
    type: [EventLogTimeSeriesPointResponse]
  })
  points!: EventLogTimeSeriesPointResponse[];
}
