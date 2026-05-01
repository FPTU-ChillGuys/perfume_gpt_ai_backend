import { Entity, Property, Enum } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { ApiProperty } from '@nestjs/swagger';
import { InventoryLogType } from '../enum/inventory-log-type.enum';
import { InventoryLogRepository } from 'src/infrastructure/domain/repositories/inventory-log.repository';

@Entity({ repository: () => InventoryLogRepository })
export class InventoryLog extends Common {
  @ApiProperty({ description: 'Nội dung log tồn kho' })
  @Property({ type: 'text' })
  inventoryLog!: string;

  @ApiProperty({ description: 'Loại log tồn kho', enum: InventoryLogType })
  @Enum(() => InventoryLogType)
  type: InventoryLogType = InventoryLogType.REPORT;

  constructor(init?: Partial<InventoryLog>) {
    super();
    Object.assign(this, init);
  }
}
