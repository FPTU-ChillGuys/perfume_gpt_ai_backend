import { BaseEntity, Entity, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { AIAcceptanceRepository } from 'src/infrastructure/domain/repositories/ai-acceptance.repository';
import { Common } from './common/common.entities';

/** Entity lưu trạng thái chấp nhận đề xuất AI của người dùng */
@Entity({ repository: () => AIAcceptanceRepository })
export class AIAcceptance extends Common {
  /** ID người dùng */
  @ApiProperty({ description: 'ID người dùng', format: 'uuid' })
  @Property({ nullable: true })
  userId?: string | null;

  @ApiProperty({ description: "Id của cart item nếu có liên quan", format: 'string', nullable: true })
  @Property({ nullable: true })
  cartItemId?: string | null;

  @ApiProperty({ description: 'ID acceptance cho một response (dùng để nhóm theo lần phản hồi)', nullable: true })
  @Property({ nullable: true })
  responseId?: string | null;

  @ApiProperty({ description: 'Ngữ cảnh phát sinh acceptance (chatbot/survey/trend/recommendation/repurchase/cart_legacy)', nullable: true })
  @Property({ nullable: true })
  contextType?: string | null;

  @ApiProperty({ description: 'Mã tham chiếu nguồn (conversationId, surveyId, ...) nếu có', nullable: true })
  @Property({ nullable: true })
  sourceRefId?: string | null;

  @ApiProperty({ description: 'Danh sách product id dưới dạng JSON string', nullable: true })
  @Property({ type: 'text', nullable: true })
  productIdsJson?: string | null;

  @ApiProperty({ description: 'Metadata mở rộng dưới dạng JSON string', nullable: true })
  @Property({ type: 'text', nullable: true })
  metadataJson?: string | null;

  @ApiProperty({ description: 'Thời điểm false no-click được phép hiển thị', nullable: true })
  @Property({ nullable: true })
  visibleAfterAt?: Date | null;

  @ApiProperty({ description: 'Thời điểm người dùng click chấp nhận', nullable: true })
  @Property({ nullable: true })
  clickedAt?: Date | null;

  /** Người dùng có chấp nhận đề xuất AI hay không */
  @ApiProperty({ description: 'Trạng thái chấp nhận AI' })
  @Property()
  isAccepted?: boolean;

  constructor(init?: Partial<AIAcceptance>) {
    super();
    Object.assign(this, init);
  }
}
