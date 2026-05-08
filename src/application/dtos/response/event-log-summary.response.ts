import { ApiProperty } from '@nestjs/swagger';

export class EventLogSummaryResponse {
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

  @ApiProperty({ description: 'Tổng số event' })
  totalCount!: number;

  @ApiProperty({ description: 'Số sự kiện tin nhắn' })
  messageCount!: number;

  @ApiProperty({ description: 'Số sự kiện tìm kiếm' })
  searchCount!: number;

  @ApiProperty({ description: 'Số sự kiện khảo sát' })
  surveyCount!: number;

  @ApiProperty({ description: 'Số sự kiện sản phẩm' })
  productCount!: number;
}
