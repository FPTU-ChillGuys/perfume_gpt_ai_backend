import { BaseEntity, Entity, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { AIAcceptanceRepository } from 'src/infrastructure/domain/repositories/ai-acceptance.repository';
import { Common } from './common/common.entities';

/** Entity lưu trạng thái chấp nhận đề xuất AI của người dùng */
@Entity({ repository: () => AIAcceptanceRepository })
export class AIAcceptance extends Common {
  /** ID người dùng */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  @Property()
  userId?: string;

  @ApiProperty({ description: "Id của cart item nếu có liên quan", format: 'string', nullable: true })
  @Property()
  cartItemId?: string | null;

  /** Người dùng có chấp nhận đề xuất AI hay không */
  @ApiProperty({ description: 'Trạng thái chấp nhận AI' })
  @Property()
  isAccepted?: boolean;

  constructor(init?: Partial<AIAcceptance>) {
    super();
    Object.assign(this, init);
  }
}
