import { Entity, Index, ManyToOne, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { Common } from '../common/common.entities';
import { VocabDictionary } from './vocab-dictionary.entity';

@Entity({ tableName: 'vocab_phrase_rule' })
@Index({ properties: ['normalizedPhrase'] })
export class VocabPhraseRule extends Common {
  @ManyToOne(() => VocabDictionary, { fieldName: 'dictionary_id' })
  dictionary!: VocabDictionary;

  @ApiProperty({ description: 'Raw phrase' })
  @Property({ type: 'text' })
  phrase!: string;

  @ApiProperty({ description: 'Normalized phrase' })
  @Property({ type: 'text' })
  normalizedPhrase!: string;

  @ApiProperty({ description: 'Rule type', example: 'consume' })
  @Property({ type: 'text' })
  ruleType!: string;

  @ApiProperty({ description: 'Scope', example: 'global' })
  @Property({ type: 'text', default: 'global' })
  scope: string = 'global';

  @ApiProperty({ description: 'Rule confidence', default: 1 })
  @Property({ default: 1 })
  confidence: number = 1;

  constructor(init?: Partial<VocabPhraseRule>) {
    super();
    Object.assign(this, init);
  }
}
