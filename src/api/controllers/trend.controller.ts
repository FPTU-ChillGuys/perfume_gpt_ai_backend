import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { AllUserLogRequest, UserLogRequest } from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ADVANCED_MATCHING_SYSTEM_PROMPT } from 'src/chatbot/utils/prompts';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';

@Controller('trends')
export class TrendController {
  constructor(
    private userLogService: UserLogService,
    @Inject(AI_SERVICE) private aiService: AIService
  ) {}

  // Trend forcasting
  @Public()
  @Post('summary')
  @ApiBaseResponse(String)
  @ApiBody({ type: AllUserLogRequest })
  async summarizeLogs(
    @Body() allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<string>> {
    const response =
      await this.userLogService.collectAndSummarizeAllUsersLogs(allUserLogRequest);

    if (!response.success) {
      return { success: false, error: 'Failed to summarize user logs' };
    }

    // Summarize with AI
    const summaryResponse = await this.aiService.textGenerateFromPrompt(
       `${response.data!.prompt}`
    );
    
    if (!summaryResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    //Trend forecasting prompt base on summary response
    const trendPrompt = 
    `Based on the following summarized user logs, identify emerging trends and patterns that could inform future product development and marketing strategies. Provide insights into user behavior, preferences, and potential market opportunities:\n
    ${summaryResponse.data}`;
    
    const trendResponse = await this.aiService.textGenerateFromPrompt(
      trendPrompt,
      ADVANCED_MATCHING_SYSTEM_PROMPT
    );

    if (!trendResponse.success) {
      return { success: false, error: 'Failed to get AI trend response' };
    }

    return { success: true, data: trendResponse.data };
  }
}
