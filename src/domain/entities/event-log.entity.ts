import { Entity, Enum, Index, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { EventLogRepository } from 'src/infrastructure/domain/repositories/event-log.repository';
import { EventLogEntityType } from '../enum/event-log-entity-type.enum';
import { EventLogEventType } from '../enum/event-log-event-type.enum';
import { Common } from './common/common.entities';

@Entity({ repository: () => EventLogRepository })
@Index({ properties: ['userId', 'createdAt'] })
@Index({ properties: ['eventType', 'createdAt'] })
export class EventLog extends Common {
  @ApiProperty({
    description: 'ID người dùng (nullable cho anonymous/system)',
    nullable: true
  })
  @Property({ type: 'text', nullable: true })
  userId?: string;

  @ApiProperty({ description: 'Loại sự kiện log', enum: EventLogEventType })
  @Enum(() => EventLogEventType)
  eventType!: EventLogEventType;

  @ApiProperty({
    description: 'Loại thực thể liên quan',
    enum: EventLogEntityType
  })
  @Enum(() => EventLogEntityType)
  entityType!: EventLogEntityType;

  @ApiProperty({
    description: 'ID thực thể liên quan (nullable)',
    nullable: true
  })
  @Property({ type: 'uuid', nullable: true })
  entityId?: string;

  @ApiProperty({
    description: 'Nội dung text cho message/search',
    nullable: true
  })
  @Property({ type: 'text', nullable: true })
  contentText?: string;

  @ApiProperty({
    description: 'Metadata dạng JSONB cho survey và dữ liệu mở rộng',
    nullable: true,
    type: Object
  })
  @Property({ type: 'json', columnType: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  constructor(init?: Partial<EventLog>) {
    super();
    Object.assign(this, init);
  }
}
