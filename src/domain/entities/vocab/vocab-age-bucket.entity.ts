import { Entity, Index, ManyToOne, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { Common } from '../common/common.entities';
import { VocabTerm } from './vocab-term.entity';

@Entity({ tableName: 'vocab_age_bucket' })
@Index({ properties: ['minAge', 'maxAge'] })
export class VocabAgeBucket extends Common {
  @ManyToOne(() => VocabTerm, { fieldName: 'term_id' })
  term!: VocabTerm;

  @ApiProperty({ description: 'Age bucket label' })
  @Property({ type: 'text' })
  label!: string;

  @ApiProperty({ description: 'Minimum age' })
  @Property()
  minAge!: number;

  @ApiProperty({ description: 'Maximum age' })
  @Property()
  maxAge!: number;

  @ApiProperty({ description: 'Priority for bucket resolution', default: 0 })
  @Property({ default: 0 })
  priority: number = 0;

  constructor(init?: Partial<VocabAgeBucket>) {
    super();
    Object.assign(this, init);
  }
}
