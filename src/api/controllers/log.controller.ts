import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { UserLogSummaryRequest } from 'src/application/dtos/request/user-log-summary.request';
import {
  AllUserLogRequest,
  UserLogRequest
} from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { UserLogSummaryResponse } from 'src/application/dtos/response/user-log-summary.response';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { convertToUTC } from 'src/infrastructure/utils/time-zone';
import {
  isDataEmpty,
  INSUFFICIENT_DATA_MESSAGES
} from 'src/infrastructure/utils/insufficient-data';
import { INSTRUCTION_TYPE_LOG } from 'src/application/constant/prompts';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { LogHelper } from './helper/logHelper.controller';

@ApiTags('Logs')
@Controller('logs')
export class LogController extends LogHelper {
  constructor(
    protected userLogService: UserLogService,
    @Inject(AI_SERVICE) protected aiService: AIService,
    protected readonly adminInstructionService: AdminInstructionService
  ) {
    super(userLogService, aiService, adminInstructionService);
  }

  /** Lấy báo cáo log hoạt động người dùng */
  @Public()
  @Get('report/activity')
  @ApiOperation({ summary: 'Lấy báo cáo log hoạt động người dùng' })
  @ApiQuery({ name: 'userId', type: String, description: 'ID của người dùng' })
  @ApiQuery({
    name: 'period',
    enum: PeriodEnum,
    description: 'Khoảng thời gian lọc'
  })
  @ApiQuery({ name: 'endDate', type: Date, description: 'Ngày kết thúc' })
  @ApiQuery({
    name: 'startDate',
    type: Date,
    required: false,
    description: 'Ngày bắt đầu (tùy chọn)'
  })
  @ApiBaseResponse(String)
  async collectLogs(
    @Query() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    // Lay va tom tat log nguoi dung
    const response =
      await this.userLogService.getReportAndPromptSummaryUserLogs(
        userLogRequest
      );

    return {
      success: response.success,
      data: response.data?.response
    };
  }

  /** Tóm tắt log người dùng bằng AI */
  @Public()
  @Get('summarize')
  @ApiOperation({ summary: 'Tóm tắt log người dùng bằng AI' })
  @ApiQuery({ name: 'userId', type: String, description: 'ID của người dùng' })
  @ApiQuery({
    name: 'period',
    enum: PeriodEnum,
    description: 'Khoảng thời gian lọc'
  })
  @ApiQuery({ name: 'endDate', type: Date, description: 'Ngày kết thúc' })
  @ApiQuery({
    name: 'startDate',
    type: Date,
    required: false,
    description: 'Ngày bắt đầu (tùy chọn)'
  })
  @ApiBaseResponse(String)
  async summarizeLogs(
    @Query() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    const response =
      await this.userLogService.getReportAndPromptSummaryUserLogs(
        userLogRequest
      );

    if (!response.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to summarize user logs',
        { userId: userLogRequest.userId, period: userLogRequest.period }
      );
    }

    if (isDataEmpty(response.data?.prompt)) {
      return Ok(INSUFFICIENT_DATA_MESSAGES.LOG_SUMMARIZE);
    }

    // Lấy admin instruction cho domain log (nếu có)
    const adminPrompt =
      await this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_LOG
      );

    // Summarize with AI
    const aiResponse = await this.aiService.textGenerateFromPrompt(
      response.data!.prompt,
      adminPrompt
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
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        { userId: userLogRequest.userId, service: 'AIService' }
      );
    }

    return Ok(aiResponse.data);
  }

  /** Tóm tắt log của tất cả người dùng bằng AI (chú ý: có thể mất thời gian và không lưu vào DB) */
  @Public()
  @Get('summarize/all')
  @ApiOperation({ summary: 'Tóm tắt log tất cả người dùng bằng AI' })
  @ApiQuery({
    name: 'period',
    enum: PeriodEnum,
    description: 'Khoảng thời gian lọc'
  })
  @ApiQuery({ name: 'endDate', type: Date, description: 'Ngày kết thúc' })
  @ApiQuery({
    name: 'startDate',
    type: Date,
    required: false,
    description: 'Ngày bắt đầu (tùy chọn)'
  })
  @ApiBaseResponse(String)
  async summarizeAllLogs(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<string>> {
    const response =
      await this.userLogService.getReportAndPromptSummaryAllUsersLogs(
        allUserLogRequest
      );

    if (!response.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to summarize user logs',
        { period: allUserLogRequest.period }
      );
    }

    if (isDataEmpty(response.data?.prompt)) {
      return Ok(INSUFFICIENT_DATA_MESSAGES.LOG_SUMMARIZE);
    }

    // Lấy admin instruction cho domain log (nếu có)
    const adminPrompt =
      await this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_LOG
      );

    // Summarize with AI
    const aiResponse = await this.aiService.textGenerateFromPrompt(
      response.data!.prompt,
      adminPrompt
    );

    if (!aiResponse.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to get AI response',
        { service: 'AIService' }
      );
    }

    return Ok(aiResponse.data);
  }

  @Cron(CronExpression.EVERY_WEEK)
  async summarizeLogsPerWeekWithCronJob(): Promise<BaseResponse<string>> {
    await this.summarizeLogsPerWeek();
    return Ok('Scheduled task completed.');
  }

  @Public()
  @Get('summarize/weekly/manual')
  @ApiOperation({ summary: 'Tóm tắt log người dùng hàng tuần (thủ công)' })
  @ApiBaseResponse(String)
  async summaryLogsPerWeekManually(): Promise<BaseResponse<string>> {
    await this.summarizeLogsPerWeek();
    return Ok('Manual log summarization completed.');
  }

  @Public()
  @Get('summarize/month/manual')
  @ApiOperation({ summary: 'Tóm tắt log người dùng hàng tháng (thủ công)' })
  @ApiBaseResponse(String)
  async summaryLogsPerMonthManually(): Promise<BaseResponse<string>> {
    await this.summarizeLogsPerMonth();
    return Ok('Manual log summarization completed.');
  }
  

  @Public()
  @Get('summarize/year/manual')
  @ApiOperation({ summary: 'Tóm tắt log người dùng hàng năm (thủ công)' })
  @ApiBaseResponse(String)
  async summaryLogsPerYearManually(): Promise<BaseResponse<string>> {
    await this.summarizeLogsPerYear();
    return Ok('Manual log summarization completed.');
  }


  /** Xem chi tiết các bản tóm tắt log người dùng */
  @Public()
  @Get('summaries')
  @ApiOperation({ summary: 'Xem chi tiết các bản tóm tắt log người dùng' })
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

  /** Xem báo cáo tóm tắt log người dùng theo ID */
  @Public()
  @Get('report/summary')
  @ApiOperation({ summary: 'Xem báo cáo tóm tắt log người dùng theo ID' })
  @ApiQuery({ name: 'userId', type: String, description: 'ID của người dùng' })
  @ApiQuery({ name: 'startDate', type: Date, description: 'Ngày bắt đầu' })
  @ApiQuery({ name: 'endDate', type: Date, description: 'Ngày kết thúc' })
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

  /** Tạo bản tóm tắt log người dùng thủ công */
  @Public()
  @Post()
  @ApiOperation({ summary: 'Tạo bản tóm tắt log người dùng thủ công' })
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
      throw new InternalServerErrorWithDetailsException(
        'Failed to save user log summary',
        { userId: userLogRequest.userId }
      );
    }
    return Ok('User log summary saved successfully');
  }
}
