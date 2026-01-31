import { Common } from './common/common.entities';

export class UserLogSummary extends Common {
  userId: string;

  // Log theo tuan hoac thang hoac nam
  period: 'weekly' | 'monthly' | 'yearly';

  startDate: Date;

  endDate: Date;

  totalLogs: number;

  logSummary: string;

  constructor(init?: Partial<UserLogSummary>) {
    super();
    Object.assign(this, init);
  }
}
