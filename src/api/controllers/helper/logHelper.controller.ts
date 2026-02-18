import { Inject } from '@nestjs/common';
import { INSTRUCTION_TYPE_LOG } from 'src/application/constant/prompts';
import { UserLogRequest } from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { AdminInstruction } from 'src/domain/entities/admin-instruction.entity';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { convertToUTC } from 'src/infrastructure/utils/time-zone';

export class LogHelper {
  constructor(
    private userLogService: UserLogService,
    @Inject(AI_SERVICE) private aiService: AIService,
    private readonly adminInstructionService: AdminInstructionService
  ) {}

  async summarizeLogsForUser(userId: string, period: PeriodEnum) {
    // Duyet tung userId de tong hop log va luu vao db
    const userLogRequest: UserLogRequest = new UserLogRequest({
      userId,
      period: period,
      endDate: new Date()
    });

    const response =
      await this.userLogService.getReportAndPromptSummaryUserLogs(
        userLogRequest
      );

    if (!response.success) {
      console.log(`Failed to summarize logs for userId: ${userId}`);
      return { success: false, error: 'Failed to summarize user logs' };
    }

    const logPrompt =
      await this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_LOG
      );

    // Summarize with AI
    const aiResponse = await this.aiService.textGenerateFromPrompt(
      response.data!.prompt,
      logPrompt
    );

    // Lay ngay bat dau
    const startDate =
      convertToUTC(userLogRequest.startDate) ||
      this.userLogService.getFirstDateOfPeriod(
        userLogRequest.period!,
        userLogRequest.endDate!
      );

    // Save summary to database
    await this.userLogService.saveUserLogSummary(
      userLogRequest.userId,
      startDate,
      userLogRequest.endDate!,
      aiResponse.data || ''
    );

    if (!aiResponse.success) {
      console.log(`Failed to get AI response for userId: ${userId}`);
    }

    console.log(`Successfully summarized logs for userId: ${userId}`);
  }

  async summarizeLogsForAllUsers(period: PeriodEnum) {
    console.log('Fetching all user IDs from logs...');
    // Lay tat ca userId co trong log
    const userIds = await this.userLogService.getAllUserIdsFromLogs();
    console.log(`Found ${userIds.length} unique user IDs.`);

    // Duyet tung userId de tong hop log va luu vao db
    for (const userId of userIds) {
      await this.summarizeLogsForUser(userId, period);
    }

    console.log('Scheduled task completed: User logs summarized and saved.');
  }

  async summarizeLogsPerWeek() {
    try {
      await this.summarizeLogsForAllUsers(PeriodEnum.WEEKLY);
    } catch (error) {
      console.error('Error summarizing weekly logs:', error);
    }
  }

  async summarizeLogsPerMonth() {
    try {
      await this.summarizeLogsForAllUsers(PeriodEnum.MONTHLY);
    } catch (error) {
      console.error('Error summarizing monthly logs:', error);
    }
  }

  async summarizeLogsPerYear() {
    try {
      await this.summarizeLogsForAllUsers(PeriodEnum.YEARLY);
    } catch (error) {
      console.error('Error summarizing yearly logs:', error);
    }
  }

  async summarizeLogsAtEndOfWeekIfHasLog(userId: string) {
    try {
      if (!this.userLogService.isLogsFromLastWeek(userId) && this.isEndOfPeriod(new Date(), PeriodEnum.WEEKLY)) {
        await this.summarizeLogsForUser(userId, PeriodEnum.WEEKLY);
      }
    } catch (error) {
      console.error('Error summarizing weekly logs:', error);
    }
  }

  async summarizeLogsAtEndOfMonthIfHasLog(userId: string) {
    try {
      if (!this.userLogService.isLogsFromLastMonth(userId) && this.isEndOfPeriod(new Date(), PeriodEnum.MONTHLY)) {
        await this.summarizeLogsForUser(userId, PeriodEnum.MONTHLY);
      }
    } catch (error) {
      console.error('Error summarizing monthly logs:', error);
    }
  }

  async summarizeLogsAtEndOfYearIfHasLog(userId: string) {
    try {
      if (!this.userLogService.isLogsFromLastYear(userId) && this.isEndOfPeriod(new Date(), PeriodEnum.YEARLY)) {
        await this.summarizeLogsForUser(userId, PeriodEnum.YEARLY);
      }
    } catch (error) {
      console.error('Error summarizing yearly logs:', error);
    }
  }

  isEndOfPeriod(date: Date, period: PeriodEnum): boolean {
    const now = new Date();
    switch (period) {
      case PeriodEnum.WEEKLY:
        return date.getDay() === 0; // Sunday
      case PeriodEnum.MONTHLY:
        return (
          date.getDate() ===
          new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
        ); // Last day of month
      case PeriodEnum.YEARLY:
        return date.getMonth() === 11 && date.getDate() === 31; // December 31st
      default:
        return false;
    }
  }
}
