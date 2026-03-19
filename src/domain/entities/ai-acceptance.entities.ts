import { Entity, Enum, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { AIAcceptanceSourceType } from 'src/domain/enum/ai-acceptance-source-type.enum';
import { AIAcceptanceRepository } from 'src/infrastructure/repositories/ai-acceptance.repository';
import { Common } from './common/common.entities';

/** Entity lưu trạng thái chấp nhận đề xuất AI của người dùng */
@Entity({ repository: () => AIAcceptanceRepository })
export class AIAcceptance extends Common {
  /** ID người dùng */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  @Property()
  userId: string;

  @ApiProperty({ description: 'Nguồn phát sinh acceptance', enum: AIAcceptanceSourceType })
  @Enum(() => AIAcceptanceSourceType)
  sourceType: AIAcceptanceSourceType;

  @ApiProperty({ description: 'ID thực thể theo source type (cart/quiz/trending/chatbot)', format: 'string', nullable: true })
  @Property({ nullable: true })
  sourceId: string | null;

  /** Người dùng có chấp nhận đề xuất AI hay không */
  @ApiProperty({ description: 'Trạng thái chấp nhận AI' })
  @Property()
  isAccepted: boolean;

  constructor(init?: Partial<AIAcceptance>) {
    super();
    Object.assign(this, init);
  }
}
