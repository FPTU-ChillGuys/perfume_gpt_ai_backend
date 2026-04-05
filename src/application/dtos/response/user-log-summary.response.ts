import { ApiProperty } from '@nestjs/swagger';
import { CommonResponse } from './common/common.response';

/** Response tóm tắt log người dùng */
export class UserLogSummaryResponse extends CommonResponse {
  /** ID người dùng */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  userId?: string;

  /** Nội dung tóm tắt log */
  @ApiProperty({ description: 'Nội dung tóm tắt log' })
  logSummary?: string;

  /** Snapshot feature dạng JSON */
  @ApiProperty({ description: 'Feature snapshot dạng JSON', required: false, type: Object })
  featureSnapshot?: Record<string, unknown>;

  /** Bản tóm tắt log theo ngày */
  @ApiProperty({ description: 'Bản tóm tắt log theo ngày', required: false, type: Object })
  dailyLogSummary?: Record<string, string>;

  /** Snapshot feature theo ngày */
  @ApiProperty({ description: 'Feature snapshot theo ngày', required: false, type: Object })
  dailyFeatureSnapshot?: Record<string, unknown>;

  /** Tổng số event đã xử lý */
  @ApiProperty({ description: 'Tổng số event đã xử lý', default: 0 })
  totalEvents?: number;

  constructor(init?: Partial<UserLogSummaryResponse>) {
    super();
    Object.assign(this, init);
  }
}
