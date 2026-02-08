import { BaseEntity, Entity, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { AIAcceptanceRepository } from 'src/infrastructure/repositories/ai-acceptance.repository';
import { Common } from './common/common.entities';

@Entity({ repository: () => AIAcceptanceRepository })
export class AIAcceptance extends Common {
  @ApiProperty()
  @Property()
  userId: string;

  @ApiProperty()
  @Property()
  isAccepted: boolean;

  constructor(init?: Partial<AIAcceptance>) {
    super();
    Object.assign(this, init);
  }
}
