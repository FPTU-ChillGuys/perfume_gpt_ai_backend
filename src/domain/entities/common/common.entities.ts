import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';

/** Entity cơ sở chứa các trường dùng chung cho tất cả entity */
@Entity()
export class Common {
  /** ID duy nhất (UUID) */
  @ApiProperty({ description: 'ID duy nhất (UUID)', format: 'uuid' })
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string;

  /** Ngày tạo bản ghi */
  @ApiProperty({ description: 'Ngày tạo bản ghi' })
  @Property()
  createdAt: Date = new Date();

  /** Ngày cập nhật bản ghi gần nhất */
  @ApiProperty({ description: 'Ngày cập nhật gần nhất' })
  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @ApiProperty({ description: 'Trạng thái hoạt động' })
  @Property({ default: true })
  isActive: boolean = true;
}
