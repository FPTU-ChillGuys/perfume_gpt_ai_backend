import { Body, Controller, Inject, Post, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { UserLogRequest } from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import {
  ADVANCED_MATCHING_SYSTEM_PROMPT,
  repurchaseRecommendationPrompt,
  aiRecommendationPrompt
} from 'src/application/constant/prompts';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { OrderService } from 'src/infrastructure/servicies/order.service';
import { Request } from 'express';
import { extractTokenFromHeader } from 'src/infrastructure/utils/extract-token';

@ApiTags('Recommendation')
@Controller('recommendation')
export class RecommendationController {
  constructor(
    private userLogService: UserLogService,
    private orderService: OrderService,
    @Inject(AI_SERVICE) private aiService: AIService
  ) {}

  /** Gợi ý mua lại V2 - Dùng log chi tiết từ user log service */
  @Public()
  @Post('repurchase/v2')
  @ApiOperation({ summary: 'Gợi ý mua lại V2 - Dùng log chi tiết' })
  @ApiBaseResponse(String)
  @ApiBody({ type: UserLogRequest })
  async repurchaseRecommendationV2(
    @Req() request: Request,
    @Body() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    //-----------------------------V2 -------------------------------------
    // Lay report va prompt tom tat log nguoi dung chi tiet hon V1
    const reportAndPromptSummary =
      await this.userLogService.getReportAndPromptSummaryUserLogs(
        userLogRequest
      );

    if (!reportAndPromptSummary.success) {
      return { success: false, error: 'Failed to get user logs' };
    }

    // Lay report don hang cua nguoi dung
    const orderReport =
      await this.orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
        userLogRequest.userId,
        extractTokenFromHeader(request) ?? ''
      );

    const combinedPrompt = `${reportAndPromptSummary.data!.prompt}\n\n${orderReport.data ?? ''}`;

    //-------------------------------------------------------------

    // Tom tat voi AI
    const summaryResponse = await this.aiService.textGenerateFromPrompt(
      `${combinedPrompt}`
    );

    if (!summaryResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    //Tao repurchase recommendation prompt dua tren summary response
    const recommendationResponse = await this.aiService.textGenerateFromPrompt(
      repurchaseRecommendationPrompt(summaryResponse.data ?? '')
    );

    if (!recommendationResponse.success) {
      return {
        success: false,
        error: 'Failed to get AI recommendation response'
      };
    }

    return { success: true, data: recommendationResponse.data };
  }

  /** Gợi ý mua lại V1 - Dùng log tóm tắt */
  @Public()
  @Post('repurchase/v1')
  @ApiOperation({ summary: 'Gợi ý mua lại V1 - Dùng log tóm tắt' })
  @ApiBaseResponse(String)
  @ApiBody({ type: UserLogRequest })
  async repurchaseRecommendationV1(
    @Req() request: Request,
    @Body() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    //-----------------------------V1 -------------------------------------
    // Lay va tom tat log nguoi dung (Nhanh hon nhung khong chi tiet bang V2)
    const userLogResponse = await this.userLogService.getUserLogSummaryReportByUserId(
      userLogRequest.userId,
      userLogRequest.startDate!,
      userLogRequest.endDate!
    );

    if (!userLogResponse.success) {
      return { success: false, error: 'Failed to get user logs' };
    }

    // Lay report don hang cua nguoi dung
    const orderReport =
      await this.orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
        userLogRequest.userId,
        extractTokenFromHeader(request) ?? ''
      );

    const combinedPrompt = `${userLogResponse.data!}\n\n${orderReport.data ?? ''}`;

    //-------------------------------------------------------------

    // Tom tat voi AI
    const summaryResponse = await this.aiService.textGenerateFromPrompt(
      `${combinedPrompt}`
    );

    if (!summaryResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    //Tao repurchase recommendation prompt dua tren summary response
    const recommendationResponse = await this.aiService.textGenerateFromPrompt(
      repurchaseRecommendationPrompt(summaryResponse.data ?? '')
    );

    if (!recommendationResponse.success) {
      return {
        success: false,
        error: 'Failed to get AI recommendation response'
      };
    }

    return { success: true, data: recommendationResponse.data };
  }

  /** Gợi ý sản phẩm bằng AI V1 - Dùng log chi tiết */
  @Public()
  @Post('recommend/ai/v1')
  @ApiOperation({ summary: 'Gợi ý AI V1 - Dùng log chi tiết' })
  @ApiBaseResponse(String)
  @ApiBody({ type: UserLogRequest })
  async aiRecommendationV1(
    @Body() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    const reportAndPromptSummary =
      await this.userLogService.getReportAndPromptSummaryUserLogs(
        userLogRequest
      );

    if (!reportAndPromptSummary.success) {
      return { success: false, error: 'Failed to summarize user logs' };
    }

    const reportResponse = await this.aiService.textGenerateFromPrompt(
      `Từ report: ${reportAndPromptSummary.data!.prompt}, hãy đưa ra các đề xuất phù hợp cho người dùng dựa trên hành vi và sở thích của họ. `
    );

    if (!reportResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    //Create repurchase recommendation prompt base on summary response
    const recommendationResponse = await this.aiService.textGenerateFromPrompt(
      aiRecommendationPrompt(reportResponse.data ?? ''),
      ADVANCED_MATCHING_SYSTEM_PROMPT
    );

    if (!recommendationResponse.success) {
      return {
        success: false,
        error: 'Failed to get AI recommendation response'
      };
    }

    return { success: true, data: recommendationResponse.data };
  }

  /** Gợi ý sản phẩm bằng AI V2 - Dùng log tóm tắt */
  @Public()
  @Post('recommend/ai/v1')
  @ApiOperation({ summary: 'Gợi ý AI V2 - Dùng log tóm tắt' })
  @ApiBaseResponse(String)
  @ApiBody({ type: UserLogRequest })
  async aiRecommendationV2(
    @Body() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    
    const summaryReport =
      await this.userLogService.getUserLogSummaryReportByUserId(
        userLogRequest.userId,
        userLogRequest.startDate!,
        userLogRequest.endDate!
      );

    if (!summaryReport.success) {
      return { success: false, error: 'Failed to summarize user logs' };
    }

    const summaryReportPrompt = `Here is the summary of user logs:\n${summaryReport.data!}`;

    const summaryResponse = await this.aiService.textGenerateFromPrompt(
      `Từ summary report: ${summaryReportPrompt}. Hãy dự đoán và tóm tắt lại hành vi, sở thích của người dùng.`,
    );

    if (!summaryResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    //Create repurchase recommendation prompt base on summary response
    const recommendationResponse = await this.aiService.textGenerateFromPrompt(
      aiRecommendationPrompt(summaryResponse.data ?? ''),
      ADVANCED_MATCHING_SYSTEM_PROMPT
    );

    if (!recommendationResponse.success) {
      return {
        success: false,
        error: 'Failed to get AI recommendation response'
      };
    }

    return { success: true, data: recommendationResponse.data };
  }
}
