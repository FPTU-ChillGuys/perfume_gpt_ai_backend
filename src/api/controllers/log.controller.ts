import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags
} from '@nestjs/swagger';
import { Public, Role } from 'src/application/common/Metadata';
import { UserLogSummaryRequest } from 'src/application/dtos/request/user-log-summary.request';
import {
  AllUserLogRequest,
  UserLogRequest
} from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { UserLogSummaryResponse } from 'src/application/dtos/response/user-log-summary.response';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { UserLogAIService } from 'src/infrastructure/servicies/user-log-ai.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { EventLogQueryRequest } from 'src/application/dtos/request/event-log.request';
import { EventLog } from 'src/domain/entities/event-log.entity';
import { EventLogPagedQueryRequest } from 'src/application/dtos/request/event-log.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import {
  EventLogCreateRequest,
  EventLogSummaryQueryRequest
} from 'src/application/dtos/request/event-log.request';
import { EventLogSummaryResponse } from 'src/application/dtos/response/event-log-summary.response';
import { EventLogTimeSeriesResponse } from 'src/application/dtos/response/event-log-timeseries.response';
import { UserLogSummaryMapper } from 'src/application/mapping/custom/user-log-summary.mapper';
import { AggregatedUserLogSummaryResponse } from 'src/application/dtos/response/aggregated-user-log-summary.response';

@Role(['admin'])
@ApiBearerAuth('jwt')
@ApiTags('Logs')
@Controller('logs')
export class LogController {
  constructor(
    protected userLogService: UserLogService,
    protected userLogAIService: UserLogAIService
  ) {}

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
      const response =
        await this.userLogService.getReportAndPromptSummaryAllUsersLogs(
          allUserLogRequest
        );

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
  @Get('all')
  @ApiOperation({ summary: 'Lấy tất cả log hoạt động người dùng' })
  @ApiBaseResponse(Array<EventLog>)
  async getAllUserLogs(): Promise<BaseResponse<EventLog[]>> {
    const response = await this.userLogService.getAllEventLogs();

    return {
      success: response.success,
      data: response.data
    };
  }

  /** Lấy event log dạng mới (message/search/quiz) */
  @CacheTTL(0)
  @Get('events')
  @ApiOperation({ summary: 'Lấy event log dạng mới' })
  @ApiBaseResponse(Array<EventLog>)
  async getEventLogs(
    @Query() request: EventLogQueryRequest
  ): Promise<BaseResponse<EventLog[]>> {
    const response = await this.userLogService.getEventLogs(request);

    return {
      success: response.success,
      data: response.data
    };
  }

  /** Lấy event log dạng mới có phân trang */
  @CacheTTL(0)
  @Get('events/paged')
  @ApiOperation({ summary: 'Lấy event log dạng mới có phân trang' })
  @ApiBaseResponse(PagedResult<EventLog>)
  async getPagedEventLogs(
    @Query() request: EventLogPagedQueryRequest
  ): Promise<BaseResponse<PagedResult<EventLog>>> {
    const response = await this.userLogService.getEventLogsPaged(request);

    return {
      success: response.success,
      data: response.data
    };
  }

  /** Tạo event log theo contract mới */
  @Post('events')
  @ApiOperation({ summary: 'Tạo event log theo contract mới' })
  @ApiBody({ type: EventLogCreateRequest })
  @ApiBaseResponse(String)
  async createEventLog(
    @Body() request: EventLogCreateRequest
  ): Promise<BaseResponse<{ id: string }>> {
    const response = await this.userLogService.createEventLog(request);

    return {
      success: response.success,
      data: response.data
    };
  }

  /** Thống kê nhanh event log cho dashboard */
  @Get('events/summary')
  @ApiOperation({ summary: 'Thống kê nhanh event log cho dashboard' })
  @ApiBaseResponse(EventLogSummaryResponse)
  async getEventLogsSummary(
    @Query() request: EventLogSummaryQueryRequest
  ): Promise<BaseResponse<EventLogSummaryResponse>> {
    const response = await this.userLogService.getEventLogsSummary(request);

    return {
      success: response.success,
      data: response.data
    };
  }

  /** Thống kê time-series event log cho dashboard chart */
  @Get('events/summary/timeseries')
  @ApiOperation({
    summary: 'Thống kê time-series event log cho dashboard chart'
  })
  @ApiBaseResponse(EventLogTimeSeriesResponse)
  async getEventLogsTimeSeries(
    @Query() request: EventLogSummaryQueryRequest
  ): Promise<BaseResponse<EventLogTimeSeriesResponse>> {
    const response = await this.userLogService.getEventLogsTimeSeries(request);

    return {
      success: response.success,
      data: response.data
    };
  }

  /** Lấy tất cả log hoạt động người dùng theo khoảng thời gian */
  @Get('all/period')
  @ApiOperation({
    summary: 'Lấy tất cả log hoạt động người dùng theo khoảng thời gian'
  })
  @ApiBaseResponse(Array<EventLog>)
  async getUserLogsWithPeriod(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<EventLog[]>> {
    const response =
      await this.userLogService.getEventLogsWithPeriod(allUserLogRequest);

    return {
      success: response.success,
      data: response.data
    };
  }


  @Get('summaries')
  @ApiOperation({ summary: 'Xem chi tiết tất cả các bản tóm tắt log người dùng, gồm overall và daily breakdown' })
  @ApiQuery({ name: 'userId', type: String })
  @ApiQuery({ name: 'startDate', type: Date })
  @ApiQuery({ name: 'endDate', type: Date, example: new Date() })
  @ApiBaseResponse(UserLogSummaryResponse, true)
  @CacheTTL(1)
  async getAllUserLogsSummaries(): Promise<BaseResponse<UserLogSummaryResponse[]>> {
    const response = await this.userLogService.getAllUserLogSummary();
    const mappedResponse: UserLogSummaryResponse[] =
      UserLogSummaryMapper.toResponseList(response.data ?? []);
    return { success: response.success, data: mappedResponse };
  }

  /** Xem 1 bản tóm tắt log user gần nhất, gồm cả overall và daily breakdown */
  @Get('summaries/detail/:userId')
  @ApiOperation({ summary: 'Xem 1 bản tóm tắt log user gần nhất, gồm overall và daily breakdown' })
  @ApiBaseResponse(UserLogSummaryResponse)
  async getUserLogSummaryDetail(
    @Param('userId') userId: string
  ): Promise<BaseResponse<UserLogSummaryResponse>> {
    const response = await this.userLogService.getUserLogSummaryByUserId(userId);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error
      };
    }

    return {
      success: true,
      data: UserLogSummaryMapper.toResponse(response.data)
    };
  }

  /** Xem chi tiết các bản tóm tắt log người dùng */
  @Get('summaries/:userId')
  @ApiOperation({ summary: 'Xem chi tiết các bản tóm tắt log người dùng, gồm overall và daily breakdown' })
  @ApiQuery({ name: 'userId', type: String })
  @ApiQuery({ name: 'startDate', type: Date })
  @ApiQuery({ name: 'endDate', type: Date, example: new Date() })
  @ApiBaseResponse(UserLogSummaryResponse, true)
  async getUserLogsSummariesById(
    @Param('userId') userId: string,
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

  /** Xem báo cáo tổng hợp summary của nhiều người dùng (không lưu DB) */
  @Get('report/summary/aggregate')
  @ApiOperation({
    summary: 'Tổng hợp summary của nhiều người dùng (runtime only), gồm overall và daily breakdown'
  })
  @ApiBaseResponse(AggregatedUserLogSummaryResponse)
  async getAggregatedUserSummaryReport(): Promise<
    BaseResponse<AggregatedUserLogSummaryResponse>
  > {
    return await this.userLogService.getAggregatedUserLogSummaryReport();
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
      userLogRequest.logSummary,
      userLogRequest.featureSnapshot,
      userLogRequest.dailyLogSummary,
      userLogRequest.dailyFeatureSnapshot
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
