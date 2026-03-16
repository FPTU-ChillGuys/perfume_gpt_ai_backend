import { ApiProperty } from '@nestjs/swagger';

/** Response tổng hợp summary của nhiều người dùng (không lưu DB) */
export class AggregatedUserLogSummaryResponse {
  @ApiProperty({ description: 'Tổng số event của toàn bộ người dùng' })
  totalEvents!: number;

  @ApiProperty({ description: 'Ngày tạo báo cáo tổng hợp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Nội dung tóm tắt tổng hợp' })
  logSummary!: string;

  @ApiProperty({
    description: 'Feature snapshot tổng hợp',
    required: false,
    type: Object
  })
  featureSnapshot?: Record<string, unknown>;

  constructor(init?: Partial<AggregatedUserLogSummaryResponse>) {
    Object.assign(this, init);
  }
}
