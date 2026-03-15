import { Entity, Index, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';
import { UserLogSummaryRepository } from 'src/infrastructure/repositories/user-log-summary.repository';

/** Entity lưu bản tóm tắt hành vi người dùng dạng rolling theo user */
@Entity({repository: () => UserLogSummaryRepository})
@Index({ properties: ['userId'] })
export class UserLogSummary extends Common {
  
  /** ID người dùng */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  @Property({ type: 'text' })
  userId!: string;

  /** Nội dung tóm tắt hành vi người dùng */
  @ApiProperty({ description: 'Nội dung tóm tắt log', type: 'string' })
  @Property({ type: 'text' })
  logSummary!: string;

  /** Snapshot feature đã trích xuất từ toàn bộ event log */
  @ApiProperty({ description: 'Feature snapshot dạng JSON', type: Object })
  @Property({ type: 'json', columnType: 'jsonb', nullable: true })
  featureSnapshot?: Record<string, unknown>;

  /** Thời điểm event mới nhất đã phản ánh vào summary */
  @ApiProperty({ description: 'Thời điểm event mới nhất đã được xử lý', required: false })
  @Property({ nullable: true })
  lastEventAt?: Date;

  /** Tổng số event đã đưa vào summary */
  @ApiProperty({ description: 'Tổng số event đã xử lý', default: 0 })
  @Property({ default: 0 })
  totalEvents: number = 0;

  constructor(init?: Partial<UserLogSummary>) {
    super();
    Object.assign(this, init);
  }
}
