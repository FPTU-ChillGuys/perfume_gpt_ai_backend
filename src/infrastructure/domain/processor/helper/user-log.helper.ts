import { Injectable } from '@nestjs/common';
import { UserLogAIService } from 'src/infrastructure/domain/user-log/user-log-ai.service';
import { PeriodEnum } from 'src/domain/enum/period.enum';

@Injectable()
export class UserLogHelper {
  constructor(protected userLogAIService: UserLogAIService) {}

  /** Ghi de log theo tuan */
  async overrideWeeklyLogSummaryByUserId(userId: string): Promise<void> {
    await this.userLogAIService.summarizeAndSaveForUser(
      userId,
      PeriodEnum.WEEKLY
    );
  }

  /** Ghi de log theo thang */
  async overrideMonthlyLogSummaryByUserId(userId: string): Promise<void> {
    await this.userLogAIService.summarizeAndSaveForUser(
      userId,
      PeriodEnum.MONTHLY
    );
  }

  /** Ghi de log theo nam */
  async overrideYearlyLogSummaryByUserId(userId: string): Promise<void> {
    await this.userLogAIService.summarizeAndSaveForUser(
      userId,
      PeriodEnum.YEARLY
    );
  }
}
