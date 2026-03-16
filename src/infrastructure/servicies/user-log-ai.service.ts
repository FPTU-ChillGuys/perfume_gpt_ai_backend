import { Injectable } from '@nestjs/common';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { AllUserLogRequest, UserLogRequest } from 'src/application/dtos/request/user-log.request';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { UserLogService } from './user-log.service';

@Injectable()
export class UserLogAIService {
  constructor(
    private readonly userLogService: UserLogService
  ) {}

  /** Tong hop log 1 user theo rolling summary khong dung AI */
  async summarizeUserLogs(request: UserLogRequest): Promise<BaseResponse<string>> {
    await this.userLogService.rebuildRollingSummaryForUser(request.userId);
    const summaryResponse = await this.userLogService.getUserLogSummaryByUserId(request.userId);
    if (!summaryResponse.success || !summaryResponse.data) {
      return { success: false, error: 'User rolling summary not found' };
    }
    return Ok(summaryResponse.data.logSummary || '');
  }

  /** Tong hop log tat ca user theo rolling summary khong dung AI */
  async summarizeAllUserLogs(): Promise<BaseResponse<string>> {
    const userIds = await this.userLogService.getAllUserIdsFromLogs();
    for (const userId of userIds) {
      await this.userLogService.rebuildRollingSummaryForUser(userId);
    }

    const summaries = await this.userLogService.getAllUserLogSummary();
    if (!summaries.success || !summaries.data) {
      return { success: false, error: 'User rolling summaries not found' };
    }

    const text = summaries.data
      .map((item) => `${item.userId}: ${item.logSummary}`)
      .join('\n');
    return Ok(text);
  }

  /** Build rolling summary va luu vao DB */
  async summarizeAndSaveForUser(userId: string, period: PeriodEnum): Promise<void> {
    await this.userLogService.rebuildRollingSummaryForUser(userId);
  }

  /** Build rolling summary cho tat ca user */
  async summarizeAndSaveForAllUsers(period: PeriodEnum): Promise<void> {
    const userIds = await this.userLogService.getAllUserIdsFromLogs();
    console.log(`Found ${userIds.length} unique user IDs.`);
    for (const userId of userIds) {
      await this.summarizeAndSaveForUser(userId, period);
    }
    console.log('Scheduled task completed: User logs summarized and saved.');
  }

  async summarizePerWeek(): Promise<void> {
    try {
      await this.summarizeAndSaveForAllUsers(PeriodEnum.WEEKLY);
    } catch (error) {
      console.error('Error summarizing weekly logs:', error);
    }
  }

  async summarizePerMonth(): Promise<void> {
    try {
      await this.summarizeAndSaveForAllUsers(PeriodEnum.MONTHLY);
    } catch (error) {
      console.error('Error summarizing monthly logs:', error);
    }
  }

  async summarizePerYear(): Promise<void> {
    try {
      await this.summarizeAndSaveForAllUsers(PeriodEnum.YEARLY);
    } catch (error) {
      console.error('Error summarizing yearly logs:', error);
    }
  }

  /** ---------------------- CRON JOB DISABLED ---------------------------- */

}
