import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { UserLogRequest } from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
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
  @Post('collect')
  @ApiBaseResponse(String)
  @ApiBody({ type: UserLogRequest })
  async collectLogs(
    @Body() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    const response =
      await this.userLogService.collectAndSummarizeUserLogs(userLogRequest);
    return {
      success: response.success,
      data: response.data?.response
    };
  }

  @Public()
  @Post('summary')
  @ApiBaseResponse(String)
  @ApiBody({ type: UserLogRequest })
  async summarizeLogs(
    @Body() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    const response =
      await this.userLogService.collectAndSummarizeUserLogs(userLogRequest);

    if (!response.success) {
      return { success: false, error: 'Failed to summarize user logs' };
    }

    const aiResponse = await this.aiService.TextGenerateFromPrompt(
      response.data!.prompt
    );

    if (!aiResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    return { success: true, data: aiResponse.data };
  }
}
