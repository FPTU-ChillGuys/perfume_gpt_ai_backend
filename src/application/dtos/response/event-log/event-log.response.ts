import { ApiProperty } from '@nestjs/swagger';
import { EventLog } from 'src/domain/entities/event-log.entity';
import { EventLogEventType } from 'src/domain/enum/event-log-event-type.enum';
import { EventLogEntityType } from 'src/domain/enum/event-log-entity-type.enum';

/** DTO phản hồi event log */
export class EventLogResponse {
  /** ID người dùng (nullable cho anonymous/system) */
  @ApiProperty({
    description: 'ID người dùng (nullable cho anonymous/system)',
    nullable: true
  })
  userId?: string;

  /** Tên người dùng (resolved from DB) */
  @ApiProperty({
    description: 'Tên người dùng (resolved từ DB)',
    required: false,
    default: 'Khách'
  })
  userName?: string;

  @ApiProperty({ description: 'Loại sự kiện log', enum: EventLogEventType })
  eventType!: EventLogEventType;

  @ApiProperty({
    description: 'Loại thực thể liên quan',
    enum: EventLogEntityType
  })
  entityType!: EventLogEntityType;

  @ApiProperty({
    description: 'ID thực thể liên quan (nullable)',
    nullable: true
  })
  entityId?: string;

  @ApiProperty({
    description: 'Nội dung text cho message/search',
    nullable: true
  })
  contentText?: string;

  @ApiProperty({
    description: 'Metadata dạng JSONB cho survey và dữ liệu mở rộng',
    nullable: true,
    type: Object
  })
  metadata?: Record<string, unknown>;

  /** Ngày tạo */
  @ApiProperty({ description: 'Ngày tạo' })
  createdAt!: Date;

  /** Ngày cập nhật */
  @ApiProperty({ description: 'Ngày cập nhật' })
  updatedAt!: Date;

  /**
   * Chuyển đổi từ Entity sang DTO.
   * @param entity - Entity EventLog từ database
   */
  static fromEntity(entity: EventLog): EventLogResponse | null {
    if (!entity) return null;

    const response = new EventLogResponse();
    response.userId = entity.userId;
    response.eventType = entity.eventType;
    response.entityType = entity.entityType;
    response.entityId = entity.entityId;
    response.contentText = entity.contentText;
    response.metadata = entity.metadata;
    response.createdAt = entity.createdAt;
    response.updatedAt = entity.updatedAt;

    return response;
  }
}
