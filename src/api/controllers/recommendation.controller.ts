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
import {
  AIRecommendationStructuredResponse,
  AIResponseMetadata
} from 'src/application/dtos/response/ai-structured.response';
import {
  isDataEmpty,
  INSUFFICIENT_DATA_MESSAGES
} from 'src/infrastructure/utils/insufficient-data';
import { Ok } from 'src/application/dtos/response/common/success-response';
import {
  InternalServerErrorWithDetailsException,
  BadRequestWithDetailsException
} from 'src/application/common/exceptions/http-with-details.exception';
import { Cron } from '@nestjs/schedule';
import { UserService } from 'src/infrastructure/servicies/user.service';
import { ProfileService } from 'src/infrastructure/servicies/profile.service';
import {
  buildCombinedPromptV1,
  buildCombinedPromptV2
} from 'src/infrastructure/utils/prompt-builder';
import { EmailService } from 'src/infrastructure/servicies/mail.service';

@ApiTags('Recommendation')
@Controller('recommendation')
export class RecommendationController {
  constructor(
    private readonly userLogService: UserLogService,
    @Inject(AI_SERVICE) private readonly aiService: AIService,
    private readonly userService: UserService,
    private readonly orderService: OrderService,
    private readonly profileService: ProfileService,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly emailService: EmailService
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
    const endpoint = 'recommendation/repurchase/v2';

    const combinedPromptResult = await buildCombinedPromptV2(
      INSTRUCTION_TYPE_RECOMMENDATION,
      this.userLogService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      userLogRequest.userId,
      process.env.PERFUME_GPT_API_TOKEN ?? ''
    );

    const recommendation = await this.generateRepurchaseRecommendation(
      combinedPromptResult.data?.combinedPrompt ?? '',
      userLogRequest.userId,
      endpoint
    );

    return Ok(recommendation);
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
    const endpoint = 'recommendation/repurchase/v1';

    const combinedPromptResult = await buildCombinedPromptV1(
      INSTRUCTION_TYPE_RECOMMENDATION,
      this.userLogService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      userLogRequest.userId,
      process.env.PERFUME_GPT_API_TOKEN ?? ''
    );

    // Gọi AI 2 lần (summary + recommendation)
    const recommendation = await this.generateRepurchaseRecommendation(
      combinedPromptResult.data?.combinedPrompt ?? '',
      userLogRequest.userId,
      endpoint
    );

    return Ok(recommendation);
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
    const endpoint = 'recommendation/recommend/ai/v1';

    // Lấy user log chi tiết
    const reportAndPromptSummary =
      await this.userLogService.getReportAndPromptSummaryUserLogs(
        userLogRequest
      );

    if (!reportAndPromptSummary.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to summarize user logs',
        {
          userId: userLogRequest.userId,
          service: 'UserLogService',
          endpoint
        }
      );
    }

    // Check data empty
    if (isDataEmpty(reportAndPromptSummary.data?.prompt)) {
      return Ok(INSUFFICIENT_DATA_MESSAGES.RECOMMENDATION);
    }

    // Gọi AI 2 lần (report + recommendation)
    const recommendation = await this.generateAIRecommendation(
      reportAndPromptSummary.data!.prompt,
      userLogRequest.userId,
      endpoint
    );

    return Ok(recommendation);
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
    const endpoint = 'recommendation/recommend/ai/v2';

    // Lấy user log summary (nhanh hơn V1)
    const summaryReport =
      await this.userLogService.getUserLogSummaryReportByUserId(
        userLogRequest.userId,
        userLogRequest.startDate!,
        userLogRequest.endDate!
      );

    if (!summaryReport.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to summarize user logs',
        {
          userId: userLogRequest.userId,
          service: 'UserLogService',
          endpoint
        }
      );
    }

    // Check data empty
    if (isDataEmpty(summaryReport.data)) {
      return Ok(INSUFFICIENT_DATA_MESSAGES.RECOMMENDATION);
    }

    // Format prompt
    const userLogPrompt = `Here is the summary of user logs:\n${summaryReport.data!}`;

    // Gọi AI với summary prompt wrapper
    const { adminPrompt, systemPrompt } = await this.getRecommendationPrompts();

    const recommendation = await this.callAI(
      aiRecommendationPrompt(userLogPrompt),
      systemPrompt,
      userLogRequest.userId,
      endpoint,
      'Failed to get AI recommendation response'
    );

    return Ok(recommendation);
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
    const endpoint = 'recommendation/recommend/ai/structured';

    // Lấy user log chi tiết
    const reportAndPromptSummary =
      await this.userLogService.getReportAndPromptSummaryUserLogs(
        userLogRequest
      );

    if (!reportAndPromptSummary.success) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to summarize user logs',
        {
          userId: userLogRequest.userId,
          service: 'UserLogService',
          endpoint
        }
      );
    }

    // Check data empty - trả về structured response với insufficient data
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

    // Gọi AI 2 lần (report + recommendation)
    const recommendation = await this.generateAIRecommendation(
      reportAndPromptSummary.data!.prompt,
      userLogRequest.userId,
      endpoint
    );

    // Build structured response
    const processingTimeMs = Date.now() - startTime;
    const period = userLogRequest.period ?? 'custom';

    const structuredResponse = new AIRecommendationStructuredResponse({
      recommendation,
      userId: userLogRequest.userId,
      period: period.toString(),
      generatedAt: new Date(),
      metadata: new AIResponseMetadata({ processingTimeMs })
    });

    return Ok(structuredResponse);
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Lấy admin instruction và build recommendation system prompt
   */
  private async getRecommendationPrompts(): Promise<{
    adminPrompt: string;
    systemPrompt: string;
  }> {
    const adminPrompt =
      await this.adminInstructionService.getSystemPromptForDomain(
        INSTRUCTION_TYPE_RECOMMENDATION
      );
    const systemPrompt = `${ADVANCED_MATCHING_SYSTEM_PROMPT}\n${adminPrompt}`;
    return { adminPrompt, systemPrompt };
  }

  /**
   * Gọi AI service với error handling tự động
   */
  private async callAI(
    prompt: string,
    systemPrompt: string,
    userId: string,
    endpoint: string,
    errorMessage: string
  ): Promise<string> {
    const response = await this.aiService.textGenerateFromPrompt(
      prompt,
      systemPrompt
    );

    if (!response.success) {
      throw new InternalServerErrorWithDetailsException(errorMessage, {
        userId,
        service: 'AIService',
        endpoint
      });
    }

    return response.data ?? '';
  }

  /**
   * Logic chung: Gọi AI 2 lần (summary -> recommendation) cho repurchase
   */
  private async generateRepurchaseRecommendation(
    combinedPrompt: string,
    userId: string,
    endpoint: string
  ): Promise<string> {
    const { adminPrompt } = await this.getRecommendationPrompts();

    // Tạo recommendation từ summary
    const recommendation = await this.callAI(
      combinedPrompt,
      adminPrompt,
      userId,
      endpoint,
      'Failed to get AI recommendation response'
    );

    return recommendation;
  }

  /**
   * Logic chung: Gọi AI 2 lần (report -> recommendation) cho AI recommendation
   */
  private async generateAIRecommendation(
    userLogPrompt: string,
    userId: string,
    endpoint: string
  ): Promise<string> {
    const { adminPrompt, systemPrompt } = await this.getRecommendationPrompts();

    // Bước 1: Tạo report
    // const report = await this.callAI(
    //   recommendationReportPrompt(userLogPrompt),
    //   adminPrompt,
    //   userId,
    //   endpoint,
    //   'Failed to get AI report'
    // );

    // Bước 2: Tạo recommendation từ report
    const recommendation = await this.callAI(
      aiRecommendationPrompt(userLogPrompt),
      systemPrompt,
      userId,
      endpoint,
      'Failed to get AI recommendation response'
    );

    return recommendation;
  }

  // ==================== CRON JOB ====================

  @Cron('0 0 * * *') // Chạy vào lúc 00:00 hàng ngày
  async generateDailyRecommendations() {
    // Logic để lấy danh sách user và tạo recommendation cho từng user
    const userIds = await this.userLogService.getAllUserIdsFromLogs();
    for (const userId of userIds) {
      try {
        const emailResponse = await this.userService.getEmailById(userId);
        if (!emailResponse.success) {
          console.error(`Failed to get email for user ${userId}`);
          continue;
        }
        const email = emailResponse.payload!;
        // Gọi hàm tạo recommendation (có thể tái sử dụng hàm repurchaseRecommendationV2 hoặc aiRecommendationV1)
        // Sau đó gửi email cho user với recommendation
        // Ví dụ: await this.emailService.sendRecommendationEmail(email, recommendationData);
        const recommendationData = await this.repurchaseRecommendationV2NonApi({
          userId,
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Lấy log trong 7 ngày qua
          endDate: new Date()
        } as UserLogRequest);

        if (!recommendationData.success) {
          console.error(`Failed to generate recommendation for user ${userId}`);
          continue;
        }

        const recommendationText = recommendationData.data ?? '';

        await this.emailService.sendEmail(
          email.toString(),
          'Daily Recommendation',
          recommendationText
        );
      } catch (error) {
        // Log lỗi nếu có
        console.error(
          `Failed to generate/send recommendation for user ${userId}:`,
          error
        );
      }
    }
  }

  /**
   * Non-API method dùng cho CRON job
   * Tạo repurchase recommendation mà không cần HTTP Request object
   */
  private async repurchaseRecommendationV2NonApi(
    userLogRequest: UserLogRequest
  ): Promise<BaseResponse<string>> {
    const endpoint = 'recommendation/repurchase/v2/cron';

    // Build combined prompt từ user logs + orders + profile
    const combinedPromptResult = await buildCombinedPromptV2(
      INSTRUCTION_TYPE_RECOMMENDATION,
      this.userLogService,
      this.orderService,
      this.profileService,
      this.adminInstructionService,
      userLogRequest.userId,
      process.env.PERFUME_GPT_API_TOKEN ?? ''
    );

    if (!combinedPromptResult.success || !combinedPromptResult.data) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to build combined prompt',
        {
          userId: userLogRequest.userId,
          service: 'PromptBuilder',
          endpoint
        }
      );
    }

    const recommendation = await this.callAI(
      combinedPromptResult.data.combinedPrompt,
      combinedPromptResult.data.adminInstruction ?? '',
      userLogRequest.userId,
      endpoint,
      'Failed to get AI recommendation response'
    );

    return Ok(recommendation);
  }
}
