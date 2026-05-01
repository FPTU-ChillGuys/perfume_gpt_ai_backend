import { Injectable } from '@nestjs/common';
import { TrendLog } from 'src/domain/entities/trend-log.entity';
import { BaseRepository } from 'src/infrastructure/domain/repositories/base/base.repository';

@Injectable()
export class TrendLogRepository extends BaseRepository<TrendLog> {
  async addAndFlush(log: TrendLog): Promise<void> {
    this.add(log);
    await this.flush();
  }

  async getLatestLogs(limit: number): Promise<TrendLog[]> {
    return this.find({}, { orderBy: { createdAt: 'DESC' }, limit });
  }
}
