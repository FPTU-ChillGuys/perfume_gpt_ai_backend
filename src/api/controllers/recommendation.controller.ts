import {
  Controller,
  Inject,
  Logger,
  Post,
  Query} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from 'src/application/common/Metadata';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import {
  INSTRUCTION_TYPE_RECOMMENDATION,
  INSTRUCTION_TYPE_REPURCHASE
} from 'src/application/constant/prompts';
import { AI_RECOMMENDATION_AND_REPURCHASE_SERVICE } from 'src/infrastructure/modules/ai.module';
import { AIService } from 'src/infrastructure/servicies/ai.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { Ok } from 'src/application/dtos/response/common/success-response';
import {
  InternalServerErrorWithDetailsException} from 'src/application/common/exceptions/http-with-details.exception';
import { UserService } from 'src/infrastructure/servicies/user.service';
import {
  buildCombinedPromptV5
} from 'src/infrastructure/utils/prompt-builder';
import { EmailService, EmailTemplate, EmailProduct } from 'src/infrastructure/servicies/mail.service';
import { parseAIRecommendationResponse } from 'src/infrastructure/utils/ai-response-parser';
import { Output } from 'ai';
import { searchOutput } from 'src/chatbot/utils/output/search.output';

@ApiTags('Recommendation')
@Controller('recommendation')
export class RecommendationController {
  logger = new Logger(RecommendationController.name);

  constructor(
    @Inject(AI_RECOMMENDATION_AND_REPURCHASE_SERVICE) private readonly aiService: AIService,
    private readonly userService: UserService,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) {}

  // ==================== PRIVATE HELPER METHODS ====================

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
      systemPrompt,
      Output.object(searchOutput)
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
   * Logic chung: Gọi AI (summary -> recommendation) cho repurchase
   */
  private async sendAIRepurchase(userId: string): Promise<boolean> {
    try {
      // Lấy thông tin user
      const userInfoResponse = await this.userService.getUserEmailInfo(userId);
      if (!userInfoResponse.success || !userInfoResponse.payload) {
        this.logger.error(`Failed to get user info for user ${userId}`);
        return false;
      }
      const { email, userName } = userInfoResponse.payload;

      // Sinh repurchase recommendation
      const repurchaseData = await this.repurchaseV2NonApi(userId);

      if (!repurchaseData.success) {
        this.logger.error(
          `Failed to generate repurchase recommendation for user ${userId}`
        );
        return false;
      }

      const repurchaseText = repurchaseData.data ?? '';

      // Parse response để lấy message và products
      const parsedResponse = parseAIRecommendationResponse(repurchaseText);
      const message = parsedResponse.message;
      const products = (parsedResponse.products as EmailProduct[]) || [];

      this.logger.log(
        `Generated repurchase recommendation for user ${userId} with ${products.length} products`
      );

      // Get frontend URL từ config
      const frontendUrl = this.configService.get<string>(
        'FRONTEND_URL',
        'https://perfumegpt.com'
      );

      // Gửi email template
      await this.emailService.sendTemplateEmail(
        email,
        '✨ Gợi ý mua lại sản phẩm yêu thích của bạn | PerfumeGPT',
        EmailTemplate.REPURCHASE,
        {
          userName: userName || 'Khách hàng',
          message,
          products,
          frontendUrl,
          savingsPercent: '15'
        }
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to generate/send repurchase for user ${userId}:`,
        error
      );
      return false;
    }
  }

  private async sendAIRecommendations(userId: string): Promise<boolean> {
    try {
      // Lấy thông tin user
      const userInfoResponse = await this.userService.getUserEmailInfo(userId);
      if (!userInfoResponse.success || !userInfoResponse.payload) {
        this.logger.error(`Failed to get user info for user ${userId}`);
        return false;
      }
      const { email, userName } = userInfoResponse.payload;

      // Sinh recommendation
      const recommendationData = await this.recommendationV2NonApi(userId);

      if (!recommendationData.success) {
        this.logger.error(
          `Failed to generate recommendation for user ${userId}`
        );
        return false;
      }

      const recommendationText = recommendationData.data ?? '';

      // Parse response để lấy message và products
      const parsedResponse = parseAIRecommendationResponse(recommendationText);
      const message = parsedResponse.message;
      const products = (parsedResponse.products as EmailProduct[]) || [];

      this.logger.log(
        `Generated recommendation for user ${userId} with ${products.length} products`
      );

      // Get frontend URL từ config
      const frontendUrl = this.configService.get<string>(
        'FRONTEND_URL',
        'https://perfumegpt.com'
      );

      // Gửi email template
      await this.emailService.sendTemplateEmail(
        email,
        '🌸 Khám phá hương nước hoa mới theo gợi ý AI | PerfumeGPT',
        EmailTemplate.RECOMMENDATION,
        {
          userName: userName || 'Khách hàng',
          heading: 'Hương nước hoa được gợi ý dành riêng cho bạn',
          message,
          products,
          frontendUrl
        }
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to generate/send recommendation for user ${userId}:`,
        error
      );
      return false;
    }
  }

  // ==================== CRON JOB ====================

  // @Cron('0 0 * * *') // Chạy vào lúc 00:00 hàng ngày
  async generateDailyRecommendations() {
    // Logic để lấy danh sách user và tạo recommendation cho từng user
    const userIds = await this.userService.getAllUserIds();
    for (const userId of userIds.payload ?? []) {
      await this.sendAIRecommendations(userId);
    }
  }

  // @Cron('0 0 * * *') // Chạy vào lúc 00:00 hàng ngày
  async generateDailyRepurchase() {
    // Logic để lấy danh sách user và tạo recommendation cho từng user
    const userIds = await this.userService.getAllUserIds();
    for (const userId of userIds.payload ?? []) {
      await this.sendAIRepurchase(userId);
    }
  }

  // ==================== PUBLIC TEST ENDPOINTS ====================

  /**
   * Test recommendation API
   * Sinh ra recommendation cho một user
   */
  @Public()
  @Public()
  @Post('test-recommendation')
  @ApiOperation({ summary: 'Test sinh recommendation cho user và gửi email' })
  @ApiQuery({
    name: 'userId',
    description: 'ID của user để test recommendation'
  })
  @ApiBaseResponse(String)
  async testRecommendation(
    @Query('userId') userId: string
  ): Promise<BaseResponse<string>> {
    try {
      await this.sendAIRecommendations(userId);
      return Ok('Recommendation generated and email sent successfully');
    } catch (error) {
      this.logger.error(`Error in testRecommendation: ${error}`);
      throw error;
    }
  }

  /**
   * Test repurchase recommendation API
   * Sinh ra repurchase recommendation cho một user và gửi email
   */
  @Public()
  @Post('test-repurchase')
  @ApiOperation({
    summary: 'Test sinh repurchase recommendation cho user và gửi email'
  })
  @ApiQuery({
    name: 'userId',
    description: 'ID của user để test repurchase recommendation'
  })
  @ApiBaseResponse(String)
  async testRepurchase(
    @Query('userId') userId: string
  ): Promise<BaseResponse<string>> {
    try {
      await this.sendAIRepurchase(userId);
      return Ok(
        'Repurchase recommendation generated and email sent successfully'
      );
    } catch (error) {
      this.logger.error(`Error in testRepurchase: ${error}`);
      throw error;
    }
  }

  /**
   * Non-API method dùng cho CRON job
   * Tạo repurchase recommendation mà không cần HTTP Request object
   */
  private async repurchaseV2NonApi(
    userId: string
  ): Promise<BaseResponse<string>> {
    // Build combined prompt từ user logs + orders + profile
    const combinedPromptResult = await buildCombinedPromptV5(
      INSTRUCTION_TYPE_REPURCHASE,
      this.adminInstructionService,
      userId
    );

    if (!combinedPromptResult.success || !combinedPromptResult.data) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to build combined prompt',
        {
          userId: userId,
          service: 'PromptBuilder',
          endpoint: 'repurchaseRecommendationV2NonApi'
        }
      );
    }

    const recommendation = await this.callAI(
      combinedPromptResult.data.combinedPrompt,
      combinedPromptResult.data.adminInstruction ?? '',
      userId,
      'repurchaseRecommendationV2NonApi',
      'Failed to get AI recommendation response'
    );

    return Ok(recommendation);
  }

  private async recommendationV2NonApi(
    userId: string
  ): Promise<BaseResponse<string>> {
    // Build combined prompt từ user logs + orders + profile
    const combinedPromptResult = await buildCombinedPromptV5(
      INSTRUCTION_TYPE_RECOMMENDATION,
      this.adminInstructionService,
      userId
    );

    if (!combinedPromptResult.success || !combinedPromptResult.data) {
      throw new InternalServerErrorWithDetailsException(
        'Failed to build combined prompt',
        {
          userId: userId,
          service: 'PromptBuilder',
          endpoint: 'repurchaseRecommendationV2NonApi'
        }
      );
    }

    const recommendation = await this.callAI(
      combinedPromptResult.data.combinedPrompt,
      combinedPromptResult.data.adminInstruction ?? '',
      userId,
      'repurchaseRecommendationV2NonApi',
      'Failed to get AI recommendation response'
    );

    return Ok(recommendation);
  }
}
