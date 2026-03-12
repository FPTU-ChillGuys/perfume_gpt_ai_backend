import { Inject, Injectable } from '@nestjs/common';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { AllUserLogRequest, UserLogRequest } from 'src/application/dtos/request/user-log.request';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { INSTRUCTION_TYPE_LOG } from 'src/application/constant/prompts';
import { convertToUTC } from '../utils/time-zone';
import { AIHelper } from '../helpers/ai.helper';
import { AI_HELPER } from '../modules/ai.module';
import { AdminInstructionService } from './admin-instruction.service';
import { UserLogService } from './user-log.service';

@Injectable()
export class UserLogAIService {
  constructor(
    private readonly userLogService: UserLogService,
    private readonly adminInstructionService: AdminInstructionService,
    @Inject(AI_HELPER) private readonly aiHelper: AIHelper
  ) {}

  /** Tong hop log 1 user va goi AI, tra ve chuoi ket qua (dung cho controller) */
  async summarizeUserLogs(request: UserLogRequest): Promise<BaseResponse<string>> {
    const reportResult = await this.userLogService.getReportAndPromptSummaryUserLogs(request);
    if (!reportResult.success || !reportResult.data) {
      return { success: false, error: 'Failed to get user log report' };
    }
    const systemPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_LOG);
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(reportResult.data.prompt, systemPrompt);
    if (!aiResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }
    return Ok(aiResponse.data);
  }

  /** Tong hop log tat ca user va goi AI, tra ve chuoi ket qua (dung cho controller) */
  async summarizeAllUserLogs(request: AllUserLogRequest): Promise<BaseResponse<string>> {
    const reportResult = await this.userLogService.getReportAndPromptSummaryAllUsersLogs(request);
    if (!reportResult.success || !reportResult.data) {
      return { success: false, error: 'Failed to get all user log report' };
    }
    const systemPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_LOG);
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(reportResult.data.prompt, systemPrompt);
    if (!aiResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }
    return Ok(aiResponse.data);
  }

  /** Tong hop log, goi AI, luu ket qua vao DB (dung cho scheduler/processor) */
  async summarizeAndSaveForUser(userId: string, period: PeriodEnum): Promise<void> {
    const userLogRequest = new UserLogRequest({ userId, period, endDate: new Date() });
    const reportResult = await this.userLogService.getReportAndPromptSummaryUserLogs(userLogRequest);
    if (!reportResult.success || !reportResult.data) {
      console.log(`Failed to summarize logs for userId: ${userId}`);
      return;
    }
    const systemPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_LOG);
    const aiResponse = await this.aiHelper.textGenerateFromPrompt(reportResult.data.prompt, systemPrompt);
    const startDate = convertToUTC(userLogRequest.startDate) ||
      this.userLogService.getFirstDateOfPeriod(userLogRequest.period!, userLogRequest.endDate!);
    await this.userLogService.saveUserLogSummary(userId, startDate, userLogRequest.endDate!, aiResponse.data || '');
    if (!aiResponse.success) {
      console.log(`Failed to get AI response for userId: ${userId}`);
    } else {
      console.log(`Successfully summarized logs for userId: ${userId}`);
    }
  }

  /** Tong hop log tat ca user, goi AI, luu ket qua vao DB */
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
}
