import { Body, Controller, Inject, Post, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { UserLogRequest } from 'src/application/dtos/request/user-log.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import {
  ADVANCED_MATCHING_SYSTEM_PROMPT,
  repurchaseRecommendationPrompt,
  aiRecommendationPrompt,
  recommendationReportPrompt,
  recommendationSummaryPrompt,
  INSTRUCTION_TYPE_RECOMMENDATION
} from 'src/application/constant/prompts';
import { AI_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { OrderService } from 'src/infrastructure/servicies/order.service';
import { Request } from 'express';
import { extractTokenFromHeader } from 'src/infrastructure/utils/extract-token';
import { AIRecommendationStructuredResponse, AIResponseMetadata } from 'src/application/dtos/response/ai-structured.response';
import { isDataEmpty, INSUFFICIENT_DATA_MESSAGES } from 'src/infrastructure/utils/insufficient-data';

@ApiTags('Recommendation')
@Controller('recommendation')
export class RecommendationController {
  constructor(
    private userLogService: UserLogService,
    private orderService: OrderService,
    @Inject(AI_SERVICE) private aiService: AIService,
    private readonly adminInstructionService: AdminInstructionService
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

    if (isDataEmpty(reportAndPromptSummary.data?.prompt) && isDataEmpty(orderReport.data)) {
      return { success: true, data: INSUFFICIENT_DATA_MESSAGES.REPURCHASE };
    }

    const combinedPrompt = `${reportAndPromptSummary.data!.prompt}\n\n${orderReport.data ?? ''}`;

    //-------------------------------------------------------------

    // Lấy admin instruction cho domain recommendation (nếu có)
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_RECOMMENDATION);

    // Tom tat voi AI
    const summaryResponse = await this.aiService.textGenerateFromPrompt(
      `${combinedPrompt}`,
      adminPrompt
    );

    if (!summaryResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    //Tao repurchase recommendation prompt dua tren summary response
    const recommendationResponse = await this.aiService.textGenerateFromPrompt(
      repurchaseRecommendationPrompt(summaryResponse.data ?? ''),
      adminPrompt
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

    if (isDataEmpty(userLogResponse.data) && isDataEmpty(orderReport.data)) {
      return { success: true, data: INSUFFICIENT_DATA_MESSAGES.REPURCHASE };
    }

    const combinedPrompt = `${userLogResponse.data!}\n\n${orderReport.data ?? ''}`;

    //-------------------------------------------------------------

    // Lấy admin instruction cho domain recommendation (nếu có)
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_RECOMMENDATION);

    // Tom tat voi AI
    const summaryResponse = await this.aiService.textGenerateFromPrompt(
      `${combinedPrompt}`,
      adminPrompt
    );

    if (!summaryResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    //Tao repurchase recommendation prompt dua tren summary response
    const recommendationResponse = await this.aiService.textGenerateFromPrompt(
      repurchaseRecommendationPrompt(summaryResponse.data ?? ''),
      adminPrompt
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

    if (isDataEmpty(reportAndPromptSummary.data?.prompt)) {
      return { success: true, data: INSUFFICIENT_DATA_MESSAGES.RECOMMENDATION };
    }

    // Lấy admin instruction cho domain recommendation (nếu có)
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_RECOMMENDATION);
    const recSystemPrompt = `${ADVANCED_MATCHING_SYSTEM_PROMPT}\n${adminPrompt}`;

    const reportResponse = await this.aiService.textGenerateFromPrompt(
      recommendationReportPrompt(reportAndPromptSummary.data!.prompt),
      adminPrompt
    );

    if (!reportResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    //Create repurchase recommendation prompt base on summary response
    const recommendationResponse = await this.aiService.textGenerateFromPrompt(
      aiRecommendationPrompt(reportResponse.data ?? ''),
      recSystemPrompt
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
  @Post('recommend/ai/v2')
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

    if (isDataEmpty(summaryReport.data)) {
      return { success: true, data: INSUFFICIENT_DATA_MESSAGES.RECOMMENDATION };
    }

    // Lấy admin instruction cho domain recommendation (nếu có)
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_RECOMMENDATION);
    const recSystemPrompt = `${ADVANCED_MATCHING_SYSTEM_PROMPT}\n${adminPrompt}`;

    const summaryReportPrompt = `Here is the summary of user logs:\n${summaryReport.data!}`;

    const summaryResponse = await this.aiService.textGenerateFromPrompt(
      recommendationSummaryPrompt(summaryReportPrompt),
      adminPrompt
    );

    if (!summaryResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    //Create repurchase recommendation prompt base on summary response
    const recommendationResponse = await this.aiService.textGenerateFromPrompt(
      aiRecommendationPrompt(summaryResponse.data ?? ''),
      recSystemPrompt
    );

    if (!recommendationResponse.success) {
      return {
        success: false,
        error: 'Failed to get AI recommendation response'
      };
    }

    return { success: true, data: recommendationResponse.data };
  }

  /**
   * Gợi ý sản phẩm bằng AI có cấu trúc - Dùng log chi tiết.
   * Trả về response kèm metadata (thời gian xử lý, userId, period).
   */
  @Public()
  @Post('recommend/ai/structured')
  @ApiOperation({ summary: 'Gợi ý AI có cấu trúc - Dùng log chi tiết' })
  @ApiBaseResponse(AIRecommendationStructuredResponse)
  @ApiBody({ type: UserLogRequest })
  async aiRecommendationStructured(
    @Body() userLogRequest: UserLogRequest
  ): Promise<BaseResponse<AIRecommendationStructuredResponse>> {
    const startTime = Date.now();

    const reportAndPromptSummary =
      await this.userLogService.getReportAndPromptSummaryUserLogs(userLogRequest);

    if (!reportAndPromptSummary.success) {
      return { success: false, error: 'Failed to summarize user logs' };
    }

    if (isDataEmpty(reportAndPromptSummary.data?.prompt)) {
      const processingTimeMs = Date.now() - startTime;
      const period = userLogRequest.period ?? 'custom';
      return {
        success: true,
        data: new AIRecommendationStructuredResponse({
          recommendation: INSUFFICIENT_DATA_MESSAGES.RECOMMENDATION,
          userId: userLogRequest.userId,
          period: period.toString(),
          generatedAt: new Date(),
          metadata: new AIResponseMetadata({ processingTimeMs })
        })
      };
    }

    // Lấy admin instruction cho domain recommendation (nếu có)
    const adminPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_RECOMMENDATION);
    const recSystemPrompt = `${ADVANCED_MATCHING_SYSTEM_PROMPT}\n${adminPrompt}`;

    const reportResponse = await this.aiService.textGenerateFromPrompt(
      recommendationReportPrompt(reportAndPromptSummary.data!.prompt),
      adminPrompt
    );

    if (!reportResponse.success) {
      return { success: false, error: 'Failed to get AI response' };
    }

    const recommendationResponse = await this.aiService.textGenerateFromPrompt(
      aiRecommendationPrompt(reportResponse.data ?? ''),
      recSystemPrompt
    );

    if (!recommendationResponse.success) {
      return {
        success: false,
        error: 'Failed to get AI recommendation response'
      };
    }

    const processingTimeMs = Date.now() - startTime;
    const period = userLogRequest.period ?? 'custom';

    const structuredResponse = new AIRecommendationStructuredResponse({
      recommendation: recommendationResponse.data ?? '',
      userId: userLogRequest.userId,
      period: period.toString(),
      generatedAt: new Date(),
      metadata: new AIResponseMetadata({ processingTimeMs })
    });

    return { success: true, data: structuredResponse };
  }
}
