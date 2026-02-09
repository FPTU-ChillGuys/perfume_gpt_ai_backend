import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { UserLogSummaryRequest } from 'src/application/dtos/request/user-log-summary.request';
import { AllUserLogRequest, UserLogRequest } from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { UserLogSummaryResponse } from 'src/application/dtos/response/user-log-summary.response';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { convertToUTC } from 'src/infrastructure/utils/time-zone';

@Controller('logs')
export class LogController {
  constructor(
    private userLogService: UserLogService,
    @Inject(AI_SERVICE) private aiService: AIService
  ) {}

  //Summarize user logs
  @Public()
  @Get('report')
  @ApiBaseResponse(String)
  async collectLogs(
    @Query() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {

    // Lay va tom tat log nguoi dung
    const response =
      await this.userLogService.getReportAndPromptUserLogs(userLogRequest);

    return {
      success: response.success,
      data: response.data?.response
    };
  }

  // Summarize user logs with AI
  @Public()
  @Get('summarize')
  @ApiBaseResponse(String)
  async summarizeLogs(
    @Query() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    const response =
      await this.userLogService.getReportAndPromptUserLogs(userLogRequest);

    if (!response.success) {
      return { success: false, error: 'Failed to summarize user logs' };
    }

    // Summarize with AI
    const aiResponse = await this.aiService.textGenerateFromPrompt(
      response.data!.prompt
    );

    // Determine start date
    const startDate =
      userLogRequest.startDate ||
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
      return { success: false, error: 'Failed to get AI response' };
    }

    return { success: true, data: aiResponse.data, error: aiResponse.error };
  }

  // Summarize all user logs with AI (attention: this may take long time and not save to db)
  @Public()
  @Get('summarize/all')
  @ApiBaseResponse(String)
  async summarizeAllLogs(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<string>> {
    const response =
      await this.userLogService.getReportAndPromptAllUsersLogs(allUserLogRequest);

    if (!response.success) {
      return { success: false, error: 'Failed to summarize user logs' };
    }

    // Summarize with AI
    const aiResponse = await this.aiService.textGenerateFromPrompt(
      response.data!.prompt
    );

    if (!aiResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    return { success: true, data: aiResponse.data, error: aiResponse.error };
  }

  @Cron(CronExpression.EVERY_WEEK) // Runs every day at weekly
  async summarizeLogsPerWeek(): Promise<BaseResponse<string>> {
    console.log('Running scheduled task to summarize user logs...');

    console.log('Fetching all user IDs from logs...');
    // Lay tat ca userId co trong log
    const userIds = await this.userLogService.getAllUserIdsFromLogs();
    console.log(`Found ${userIds.length} unique user IDs.`);

    // Duyet tung userId de tong hop log va luu vao db
    for (const userId of userIds) {
      const userLogRequest: UserLogRequest = new UserLogRequest({
        userId,
        period: PeriodEnum.WEEKLY,
        endDate: new Date()
      });

      const response =
        await this.userLogService.getReportAndPromptUserLogs(userLogRequest);

      if (!response.success) {
        console.log(`Failed to summarize logs for userId: ${userId}`);
        return { success: false, error: 'Failed to summarize user logs' };
      }

      // Summarize with AI
      const aiResponse = await this.aiService.textGenerateFromPrompt(
        response.data!.prompt
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
        return { success: false, error: 'Failed to get AI response' };
      }

      console.log(`Successfully summarized logs for userId: ${userId}`);
    }

    console.log('Scheduled task completed: User logs summarized and saved.');

    return { success: true, data: 'Scheduled task completed.' };
  }

  @Cron(CronExpression.EVERY_DAY_AT_10AM) // Runs every day at daily
  async summarizeLogsPerDay(): Promise<BaseResponse<string>> {
    console.log('Running scheduled task to summarize user logs...');

    console.log('Fetching all user IDs from logs...');
    // Lay tat ca userId co trong log
    const userIds = await this.userLogService.getAllUserIdsFromLogs();
    console.log(`Found ${userIds.length} unique user IDs.`);

    // Duyet tung userId de tong hop log va luu vao db
    for (const userId of userIds) {
      const userLogRequest: UserLogRequest = new UserLogRequest({
        userId,
        period: PeriodEnum.WEEKLY,
        endDate: new Date()
      });

      const response =
        await this.userLogService.getReportAndPromptUserLogs(userLogRequest);

      if (!response.success) {
        console.log(`Failed to summarize logs for userId: ${userId}`);
        return { success: false, error: 'Failed to summarize user logs' };
      }

      // Summarize with AI
      const aiResponse = await this.aiService.textGenerateFromPrompt(
        response.data!.prompt
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
        return { success: false, error: 'Failed to get AI response' };
      }

      console.log(`Successfully summarized logs for userId: ${userId}`);
    }

    console.log('Scheduled task completed: User logs summarized and saved.');

    return { success: true, data: 'Scheduled task completed.' };
  }

  // Xem chi tiet log nguoi dung
  @Public()
  @Get('summaries')
  @ApiQuery({ name: 'userId', type: String })
  @ApiQuery({ name: 'startDate', type: Date })
  @ApiQuery({ name: 'endDate', type: Date, example: new Date() })
  @ApiBaseResponse(UserLogSummaryResponse, true)
  async getUserLogsSummariesById(
    @Query('userId') userId: string,
    @Query('endDate') endDate: Date,
    @Query('startDate') startDate: Date
  ): Promise<BaseResponse<UserLogSummaryResponse[]>> {
    const response = await this.userLogService.getUserLogSummariesByUserId(
      userId,
      startDate,
      endDate
    );
    return response;
  }

  // Xem log report nguoi dung
  @Public()
  @Get('report')
  @ApiBaseResponse(String)
  async getUserLogsSummaryReportById(
    @Query('userId') userId: string,
    @Query('endDate') endDate: Date,
    @Query('startDate') startDate: Date
  ): Promise<BaseResponse<string>> {
    const response = await this.userLogService.getUserLogSummaryReportByUserId(
      userId,
      startDate,
      endDate
    );
    return response;
  }

  // Tao tom tat log nguoi dung
  @Public()
  @Post()
  @ApiBody({ type: UserLogSummaryRequest })
  @ApiBaseResponse(String)
  async createUserLogSummary(
    @Body() userLogRequest: UserLogSummaryRequest
  ): Promise<BaseResponse<string>> {
    const response = await this.userLogService.saveUserLogSummary(
      userLogRequest.userId,
      userLogRequest.startDate,
      userLogRequest.endDate,
      userLogRequest.logSummary
    );

    if (!response.success) {
      return { success: false, error: 'Failed to save user log summary' };
    }
    return { success: true, data: 'User log summary saved successfully' };
  }
}
