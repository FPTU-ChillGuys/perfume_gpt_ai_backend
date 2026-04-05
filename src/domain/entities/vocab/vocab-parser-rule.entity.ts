import { Entity, Index, ManyToOne, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { Common } from '../common/common.entities';
import { VocabDictionary } from './vocab-dictionary.entity';

@Entity({ tableName: 'vocab_parser_rule' })
@Index({ properties: ['dictionary', 'ruleGroup', 'priority'] })
export class VocabParserRule extends Common {
  @ManyToOne(() => VocabDictionary, { fieldName: 'dictionary_id' })
  dictionary!: VocabDictionary;

  @ApiProperty({ description: 'Rule group', example: 'age_attribute_value' })
  @Property({ type: 'text', fieldName: 'rule_group' })
  ruleGroup!: string;

  @ApiProperty({ description: 'Pattern text or regex source' })
  @Property({ type: 'text' })
  pattern!: string;

  @ApiProperty({ description: 'Pattern is regular expression', default: true })
  @Property({ fieldName: 'is_regex', default: true })
  isRegex: boolean = true;

  @ApiProperty({ description: 'Priority for matching order', default: 0 })
  @Property({ default: 0 })
  priority: number = 0;

  constructor(init?: Partial<VocabParserRule>) {
    super();
    Object.assign(this, init);
  }
}
