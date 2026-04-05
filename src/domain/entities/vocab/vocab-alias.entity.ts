import { Entity, Index, ManyToOne, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { Common } from '../common/common.entities';
import { VocabTerm } from './vocab-term.entity';

@Entity({ tableName: 'vocab_alias' })
@Index({ properties: ['normalizedAlias'] })
export class VocabAlias extends Common {
  @ManyToOne(() => VocabTerm, { fieldName: 'term_id' })
  term!: VocabTerm;

  @ApiProperty({ description: 'Alias text' })
  @Property({ type: 'text' })
  aliasText!: string;

  @ApiProperty({ description: 'Normalized alias text' })
  @Property({ type: 'text' })
  normalizedAlias!: string;

  @ApiProperty({ description: 'Alias confidence', default: 0.95 })
  @Property({ default: 0.95 })
  confidence: number = 0.95;

  @ApiProperty({ description: 'Alias kind', default: 'synonym' })
  @Property({ type: 'text', default: 'synonym' })
  aliasKind: string = 'synonym';

  constructor(init?: Partial<VocabAlias>) {
    super();
    Object.assign(this, init);
  }
}
