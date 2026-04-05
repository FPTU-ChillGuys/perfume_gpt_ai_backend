import { Entity, Index, OneToMany, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { Common } from '../common/common.entities';
import { VocabTerm } from './vocab-term.entity';

@Entity({ tableName: 'vocab_dictionary' })
@Index({ properties: ['version'] })
export class VocabDictionary extends Common {
  @ApiProperty({ description: 'Dictionary version' })
  @Property({ type: 'text' })
  version!: string;

  @ApiProperty({ description: 'Snapshot source' })
  @Property({ type: 'text' })
  source!: string;

  @ApiProperty({ description: 'Build status' })
  @Property({ type: 'text', default: 'active' })
  status: string = 'active';

  @ApiProperty({ description: 'Build timestamp', required: false })
  @Property({ nullable: true })
  builtAt?: Date;

  @ApiProperty({ description: 'Dictionary stats snapshot', type: Object })
  @Property({ type: 'json', columnType: 'jsonb' })
  stats!: Record<string, unknown>;

  @ApiProperty({ description: 'Serializable snapshot payload', type: Object })
  @Property({ type: 'json', columnType: 'jsonb' })
  snapshotPayload!: Record<string, unknown>;

  @OneToMany(() => VocabTerm, term => term.dictionary)
  terms = new Array<VocabTerm>();

  constructor(init?: Partial<VocabDictionary>) {
    super();
    Object.assign(this, init);
  }
}
