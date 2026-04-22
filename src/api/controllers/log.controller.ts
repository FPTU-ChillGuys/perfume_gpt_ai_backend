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
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { UserLogAIService } from 'src/infrastructure/domain/user-log/user-log-ai.service';
import { ApiBaseResponse, ExtendApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
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
import { PeriodEnum } from 'src/domain/enum/period.enum';

@Role(['admin'])
@ApiBearerAuth('jwt')
@ApiTags('Logs')
@Controller('logs')
export class LogController {
  constructor(
    protected userLogService: UserLogService,
    protected userLogAIService: UserLogAIService
  ) { }

  /** Lấy báo cáo tất cả log hoạt động người dùng */
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
    } catch (error: any) {
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


  @Get('summaries')
  @ApiOperation({ summary: 'Xem chi tiết tất cả các bản tóm tắt log người dùng, gồm overall và daily breakdown' })
  @ApiQuery({ name: 'period', required: false })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiBaseResponse(UserLogSummaryResponse, true)
  @CacheTTL(1)
  async getAllUserLogsSummaries(
    @Query() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<UserLogSummaryResponse[]>> {
    const hasTimeFilter =
      Boolean(allUserLogRequest.startDate) ||
      Boolean(allUserLogRequest.endDate) ||
      Boolean(allUserLogRequest.period);

    const response = await this.userLogService.getAllUserLogSummary(
      hasTimeFilter ? allUserLogRequest : undefined
    );

    return { success: response.success, data: response.data ?? [] };
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

}
