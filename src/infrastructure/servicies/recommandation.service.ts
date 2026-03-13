import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Output } from 'ai';
import { INSTRUCTION_TYPE_RECOMMENDATION, INSTRUCTION_TYPE_REPURCHASE } from 'src/application/constant/prompts';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { searchOutput } from 'src/chatbot/utils/output/search.output';
import { buildCombinedPromptV5 } from '../utils/prompt-builder';
import { parseAIRecommendationResponse } from '../utils/ai-response-parser';
import { AIHelper } from '../helpers/ai.helper';
import { AI_RECOMMENDATION_HELPER } from '../modules/ai.module';
import { AdminInstructionService } from './admin-instruction.service';
import { EmailService, EmailProduct, EmailTemplate } from './mail.service';
import { UserService } from './user.service';

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    @Inject(AI_RECOMMENDATION_HELPER) private readonly aiHelper: AIHelper,
    private readonly adminInstructionService: AdminInstructionService,
    private readonly userService: UserService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) { }

  private async generateAIText(
    prompt: string,
    systemPrompt: string,
    userId: string,
    endpoint: string
  ): Promise<string> {
    const response = await this.aiHelper.textGenerateFromPrompt(
      prompt,
      systemPrompt,
      Output.object(searchOutput)
    );
    if (!response.success) {
      throw new InternalServerErrorWithDetailsException('Failed to get AI recommendation response', {
        userId,
        service: 'AIHelper',
        endpoint
      });
    }
    return response.data ?? '';
  }

  async generateRecommendationText(userId: string): Promise<BaseResponse<string>> {
    const promptResult = await buildCombinedPromptV5(
      INSTRUCTION_TYPE_RECOMMENDATION,
      this.adminInstructionService,
      userId
    );
    if (!promptResult.success || !promptResult.data) {
      throw new InternalServerErrorWithDetailsException('Failed to build combined prompt', {
        userId,
        service: 'PromptBuilder',
        endpoint: 'generateRecommendationText'
      });
    }
    const text = await this.generateAIText(
      promptResult.data.combinedPrompt,
      promptResult.data.adminInstruction ?? '',
      userId,
      'generateRecommendationText'
    );
    return Ok(text);
  }

  async generateRepurchaseText(userId: string): Promise<BaseResponse<string>> {
    const promptResult = await buildCombinedPromptV5(
      INSTRUCTION_TYPE_REPURCHASE,
      this.adminInstructionService,
      userId
    );
    if (!promptResult.success || !promptResult.data) {
      throw new InternalServerErrorWithDetailsException('Failed to build combined prompt', {
        userId,
        service: 'PromptBuilder',
        endpoint: 'generateRepurchaseText'
      });
    }
    const text = await this.generateAIText(
      promptResult.data.combinedPrompt,
      promptResult.data.adminInstruction ?? '',
      userId,
      'generateRepurchaseText'
    );
    return Ok(text);
  }

  async sendRecommendation(userId: string): Promise<boolean> {
    try {
      const userInfo = await this.userService.getUserEmailInfo(userId);
      if (!userInfo.success || !userInfo.payload) {
        this.logger.error(`Failed to get user info for user ${userId}`);
        return false;
      }
      const { email, userName } = userInfo.payload;

      const result = await this.generateRecommendationText(userId);
      if (!result.success) {
        this.logger.error(`Failed to generate recommendation for user ${userId}`);
        return false;
      }

      const parsed = parseAIRecommendationResponse(result.data ?? '');
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://perfumegpt.com');

      await this.emailService.sendTemplateEmail(
        email,
        '🌸 Khám phá hương nước hoa mới theo gợi ý AI | PerfumeGPT',
        EmailTemplate.RECOMMENDATION,
        {
          userName: userName || 'Khách hàng',
          heading: 'Hương nước hoa được gợi ý dành riêng cho bạn',
          message: parsed.message,
          products: (parsed.products as EmailProduct[]) || [],
          frontendUrl
        }
      );
      this.logger.log(`Sent recommendation email to ${email} for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send recommendation for user ${userId}:`, error);
      return false;
    }
  }

  async sendRepurchase(userId: string): Promise<boolean> {
    try {
      const userInfo = await this.userService.getUserEmailInfo(userId);
      if (!userInfo.success || !userInfo.payload) {
        this.logger.error(`Failed to get user info for user ${userId}`);
        return false;
      }
      const { email, userName } = userInfo.payload;

      const result = await this.generateRepurchaseText(userId);
      if (!result.success) {
        this.logger.error(`Failed to generate repurchase for user ${userId}`);
        return false;
      }

      const parsed = parseAIRecommendationResponse(result.data ?? '');
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://perfumegpt.com');

      await this.emailService.sendTemplateEmail(
        email,
        '✨ Gợi ý mua lại sản phẩm yêu thích của bạn | PerfumeGPT',
        EmailTemplate.REPURCHASE,
        {
          userName: userName || 'Khách hàng',
          message: parsed.message,
          products: (parsed.products as EmailProduct[]) || [],
          frontendUrl,
          savingsPercent: '15'
        }
      );
      this.logger.log(`Sent repurchase email to ${email} for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send repurchase for user ${userId}:`, error);
      return false;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: 'Asia/Ho_Chi_Minh' }) // Chạy vào 8h sáng mỗi ngày
  async sendRecommendationToAllUsers(): Promise<void> {
    this.logger.log('Bắt đầu chạy cron job: Gửi daily recommendation cho tất cả người dùng');
    try {
      const userIds = await this.userService.getAllUserIds();
      for (const userId of userIds.payload ?? []) {
        await this.sendRecommendation(userId);
      }
      this.logger.log('Đã hoàn thành cron job: Gửi daily recommendation');
    } catch (error) {
      this.logger.error('Lỗi khi chạy cron job daily recommendation:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM, { timeZone: 'Asia/Ho_Chi_Minh' }) // Chạy vào 9h sáng mỗi ngày
  async sendRepurchaseToAllUsers(): Promise<void> {
    this.logger.log('Bắt đầu chạy cron job: Gửi daily repurchase cho tất cả người dùng');
    try {
      const userIds = await this.userService.getAllUserIds();
      for (const userId of userIds.payload ?? []) {
        await this.sendRepurchase(userId);
      }
      this.logger.log('Đã hoàn thành cron job: Gửi daily repurchase');
    } catch (error) {
      this.logger.error('Lỗi khi chạy cron job daily repurchase:', error);
    }
  }
}

