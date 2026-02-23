import { Entity, Enum, Property } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { ReviewTypeEnum } from '../enum/review-log-type.enum';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class ReviewLog extends Common {
  @ApiProperty({ description: 'Nội dung log đánh giá' })
  @Enum(() => ReviewTypeEnum)
  typeReview: ReviewTypeEnum;

  @ApiProperty({ description: 'ID của variant (nếu type là ID)' })
  @Property({ type: 'text', nullable: true })
  variantId?: string;

  @ApiProperty({ description: 'Nội dung log đánh giá' })
  @Property({ type: 'text' })
  reviewLog!: string;

  constructor(init?: Partial<ReviewLog>) {
    super();
    Object.assign(this, init);
  }
}
