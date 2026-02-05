import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { UserLogSummaryRequest } from 'src/application/dtos/request/user-log-summary.request';
import { UserLogRequest } from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { UserLogSummaryResponse } from 'src/application/dtos/response/user-log-summary.response';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';

@Controller('logs')
export class LogController {
  constructor(
    private userLogService: UserLogService,
    @Inject(AI_SERVICE) private aiService: AIService
  ) {}

  //Summarize user logs
  @Public()
  @Get('collect')
  @ApiBaseResponse(String)
  async collectLogs(
    @Query() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    const response =
      await this.userLogService.collectAndSummarizeUserLogs(userLogRequest);
    return {
      success: response.success,
      data: response.data?.response
    };
  }

  @Public()
  @Get('summary')
  @ApiBaseResponse(String)
  async summarizeLogs(
    @Query() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    const response =
      await this.userLogService.collectAndSummarizeUserLogs(userLogRequest);

    if (!response.success) {
      return { success: false, error: 'Failed to summarize user logs' };
    }

    // Summarize with AI
    const aiResponse = await this.aiService.textGenerateFromPrompt(
      response.data!.prompt
    );

    // Determine start date
    const startDate = userLogRequest.startDate || this.userLogService.getFirstDateOfPeriod(userLogRequest.period!, userLogRequest.endDate!);

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

  // Xem chi tiet log nguoi dung
  @Public()
  @Get()
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
  @Get("report")
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
