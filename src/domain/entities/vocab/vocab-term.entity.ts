import { Entity, Index, ManyToOne, OneToMany, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { Common } from '../common/common.entities';
import { VocabDictionary } from './vocab-dictionary.entity';
import { VocabAlias } from './vocab-alias.entity';
import { VocabAgeBucket } from './vocab-age-bucket.entity';

@Entity({ tableName: 'vocab_term' })
@Index({ properties: ['dictionary', 'entityType', 'canonical'] })
export class VocabTerm extends Common {
  @ManyToOne(() => VocabDictionary, { fieldName: 'dictionary_id' })
  dictionary!: VocabDictionary;

  @ApiProperty({ description: 'Entity type', example: 'brand' })
  @Property({ type: 'text' })
  entityType!: string;

  @ApiProperty({ description: 'Canonical term' })
  @Property({ type: 'text' })
  canonical!: string;

  @ApiProperty({ description: 'Canonical term normalized without accents' })
  @Property({ type: 'text' })
  normalizedCanonical!: string;

  @ApiProperty({ description: 'Priority for tie-break', default: 0 })
  @Property({ default: 0 })
  priority: number = 0;

  @ApiProperty({ description: 'Confidence score', default: 1 })
  @Property({ default: 1 })
  confidence: number = 1;

  @OneToMany(() => VocabAlias, (alias) => alias.term)
  aliases = new Array<VocabAlias>();

  @OneToMany(() => VocabAgeBucket, (bucket) => bucket.term)
  ageBuckets = new Array<VocabAgeBucket>();

  constructor(init?: Partial<VocabTerm>) {
    super();
    Object.assign(this, init);
  }
}
