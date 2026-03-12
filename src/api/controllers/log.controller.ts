import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public, Role } from 'src/application/common/Metadata';
import { UserLogSummaryRequest } from 'src/application/dtos/request/user-log-summary.request';
import {
  AllUserLogRequest,
  UserLogRequest
} from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { UserLogSummaryResponse } from 'src/application/dtos/response/user-log-summary.response';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { UserLog } from 'src/domain/entities/user-log.entity';
import { CacheTTL } from '@nestjs/cache-manager';

@Role(['admin'])
@ApiBearerAuth("jwt")
@ApiTags('Logs')
@Controller('logs')
export class LogController {
  constructor(protected userLogService: UserLogService) {}

  /** Lấy báo cáo tất cả log hoạt động người dùng */
  @CacheTTL(1)
  @Public()
  @Get('report/activity/all')
  @ApiOperation({ summary: 'Lấy báo cáo tất cả log hoạt động người dùng' })
  @ApiBaseResponse(String)
  async getReportFromAllLogs(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<string>> {
    // Lay va tom tat log nguoi dung
    try {
      const response = await this.userLogService.getReportAndPromptSummaryAllUsersLogs(allUserLogRequest);

      return {
        success: response.success,
        data: response.data?.response
      };
    } catch (error) {
      throw new InternalServerErrorWithDetailsException(error);
    }
  }

  /** Lấy báo cáo log hoạt động người dùng */
  @Get('report/activity/user')
  @ApiOperation({ summary: 'Lấy báo cáo log hoạt động người dùng' })
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



  /** Lấy tất cả log hoạt động người dùng */
  @CacheTTL(0)
  @Get("all")
  @ApiOperation({ summary: 'Lấy tất cả log hoạt động người dùng' })
  @ApiBaseResponse(Array<UserLog>)
  async getAllUserLogs(
  ): Promise<BaseResponse<UserLog[]>> {
    const response = await this.userLogService.getAllLogs();

    return {
      success: response.success,
      data: response.data
    };
  }

  /** Lấy tất cả log hoạt động người dùng theo khoảng thời gian */
  @Get("all/period")
  @ApiOperation({ summary: 'Lấy tất cả log hoạt động người dùng theo khoảng thời gian' })
  @ApiBaseResponse(Array<UserLog>)
  async getUserLogsWithPeriod(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<UserLog[]>> {
    const response = await this.userLogService.getUserLogsWithPeriod(allUserLogRequest);

    return {
      success: response.success,
      data: response.data
    };
  }

  /** Tóm tắt log người dùng bằng AI */
  @Get('summarize')
  @ApiOperation({ summary: 'Tóm tắt log người dùng bằng AI' })
  @ApiBaseResponse(String)
  async summarizeLogs(
    @Query() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    return this.userLogService.summarizeUserLogs(userLogRequest);
  }

  /** Tóm tắt log của tất cả người dùng bằng AI (chú ý: có thể mất thời gian và không lưu vào DB) */
  @Get('summarize/all')
  @ApiOperation({ summary: 'Tóm tắt log tất cả người dùng bằng AI' })
  @ApiBaseResponse(String)
  async summarizeAllLogs(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<string>> {
    return this.userLogService.summarizeAllUserLogs(allUserLogRequest);
  }

  @Cron(CronExpression.EVERY_WEEK)
  async summarizeLogsPerWeekWithCronJob(): Promise<BaseResponse<string>> {
    await this.userLogService.summarizePerWeek();
    return Ok('Scheduled task completed.');
  }

  @Get('summarize/weekly/manual')
  @ApiOperation({ summary: 'Tóm tắt log người dùng hàng tuần (thủ công)' })
  @ApiBaseResponse(String)
  async summaryLogsPerWeekManually(): Promise<BaseResponse<string>> {
    await this.userLogService.summarizePerWeek();
    return Ok('Manual log summarization completed.');
  }

  @Get('summarize/month/manual')
  @ApiOperation({ summary: 'Tóm tắt log người dùng hàng tháng (thủ công)' })
  @ApiBaseResponse(String)
  async summaryLogsPerMonthManually(): Promise<BaseResponse<string>> {
    await this.userLogService.summarizePerMonth();
    return Ok('Manual log summarization completed.');
  }

  @Get('summarize/year/manual')
  @ApiOperation({ summary: 'Tóm tắt log người dùng hàng năm (thủ công)' })
  @ApiBaseResponse(String)
  async summaryLogsPerYearManually(): Promise<BaseResponse<string>> {
    await this.userLogService.summarizePerYear();
    return Ok('Manual log summarization completed.');
  }


  /** Xem chi tiết các bản tóm tắt log người dùng */
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
