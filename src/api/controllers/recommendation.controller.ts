import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { UserLogRequest } from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ADVANCED_MATCHING_SYSTEM_PROMPT } from 'src/chatbot/utils/prompts';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';

@Controller('recommendation')
export class RecommendationController {
  constructor(
    private userLogService: UserLogService,
    @Inject(AI_SERVICE) private aiService: AIService
  ) {}

  //Repurchase recommendation
  @Public()
  @Post()
  @ApiBaseResponse(String)
  @ApiBody({ type: UserLogRequest })
  async repurchaseRecommendation(
    @Body() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    const response =
      await this.userLogService.collectAndSummarizeUserLogs(userLogRequest);

    if (!response.success) {
      return { success: false, error: 'Failed to summarize user logs' };
    }

    const summaryResponse = await this.aiService.textGenerateFromPrompt(
      `${response.data!.prompt}`
    );

    if (!summaryResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    //Create repurchase recommendation prompt base on summary response
    const recommendationPrompt = 
    `Based on the following summarized user logs, provide personalized repurchase recommendations for products the users have shown interest in. Consider their preferences, past interactions, and any emerging trends that could influence their purchasing decisions:\n
    ${summaryResponse.data}`;

    const recommendationResponse = await this.aiService.textGenerateFromPrompt(
      recommendationPrompt
    );

    if (!recommendationResponse.success) {
      return { success: false, error: 'Failed to get AI recommendation response' };
    }

    return { success: true, data: recommendationResponse.data };
  }

  //AI recommendation
  @Public()
  @Post()
  @ApiBaseResponse(String)
  @ApiBody({ type: UserLogRequest })
  async aiRecommendation(
    @Body() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    const response =
      await this.userLogService.collectAndSummarizeUserLogs(userLogRequest);

    if (!response.success) {
      return { success: false, error: 'Failed to summarize user logs' };
    }

    const summaryResponse = await this.aiService.textGenerateFromPrompt(
      `${response.data!.prompt}`,

    );

    if (!summaryResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    //Create repurchase recommendation prompt base on summary response
    const recommendationPrompt = 
    `Based on the following summarized user logs, provide personalized AI-driven recommendations for products or services that align with the users' interests and preferences. Consider their past interactions, preferences, and any emerging trends that could enhance their experience:\n
    ${summaryResponse.data}`;

    const recommendationResponse = await this.aiService.textGenerateFromPrompt(
      recommendationPrompt,
      ADVANCED_MATCHING_SYSTEM_PROMPT
    );

    if (!recommendationResponse.success) {
      return { success: false, error: 'Failed to get AI recommendation response' };
    }

    return { success: true, data: recommendationResponse.data };
  }
}
