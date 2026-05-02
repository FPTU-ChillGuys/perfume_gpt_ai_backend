import { Injectable } from '@nestjs/common';
import { InventoryLog } from 'src/domain/entities/inventory-log.entity';
import { BaseRepository } from 'src/infrastructure/domain/repositories/base/base.repository';

@Injectable()
export class InventoryLogRepository extends BaseRepository<InventoryLog> {
  async persistAndReturn(log: InventoryLog): Promise<InventoryLog> {
    this.add(log);
    await this.flush();
    return log;
  }
}
