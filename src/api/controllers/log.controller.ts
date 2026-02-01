import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { UserLogRequest } from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';

@Controller('logs')
export class LogController {
  constructor(private userLogService: UserLogService) {}

  @Public()
  @Post('summarize')
  @ApiBaseResponse(String)
  @ApiBody({ type: UserLogRequest })
  async summarizeLogs(
    @Body() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    return this.userLogService.summarizeUserLogs(userLogRequest);
  }

}
