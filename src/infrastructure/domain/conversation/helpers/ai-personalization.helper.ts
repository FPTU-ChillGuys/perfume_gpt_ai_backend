import { Injectable, Logger } from '@nestjs/common';
import { UIMessage } from 'ai';
import { v4 as uuid } from 'uuid';
import { AnalysisObject } from 'src/chatbot/output/analysis.output';
import { ProfileTool } from 'src/chatbot/tools/profile.tool';
import { AIAnalysisHelper } from './ai-analysis.helper';

/**
 * Helper xử lý việc thu thập dữ liệu cá nhân hóa (Personalization) cho AI.
 */
@Injectable()
export class AIPersonalizationHelper {
  private readonly logger = new Logger(AIPersonalizationHelper.name);

  constructor(
    private readonly profileTool: ProfileTool,
    private readonly analysisHelper: AIAnalysisHelper
  ) {}

  /**
   * Xây dựng danh sách các tin nhắn hệ thống chứa ngữ cảnh cá nhân hóa (TOON).
   */
  async buildPersonalizationToonMessages(
    userId: string,
    isGuestUser: boolean,
    analysis: AnalysisObject
  ): Promise<UIMessage[]> {
    if (isGuestUser || this.analysisHelper.isObjectiveOrGiftFlow(analysis)) {
      return [];
    }

    if (
      !['Search', 'Consult', 'Recommend', 'Compare'].includes(analysis.intent)
    ) {
      return [];
    }

    try {
      const payload =
        await this.profileTool.getProfileRecommendationContextPayload(userId);
      if (!payload || payload.source === 'none') {
        return [];
      }

      const sourcePriority = Array.isArray(payload.sourcePriority)
        ? payload.sourcePriority.join(' > ')
        : 'INPUT > ORDER > SURVEY > PROFILE';

      const messages: UIMessage[] = [
        this.createSystemMessage(
          `PERSONALIZATION_SOURCE_PRIORITY: ${sourcePriority}. Khi dữ liệu xung đột, phải ưu tiên từ trái sang phải.`
        ),
        this.createSystemMessage(
          `PERSONALIZATION_CONTEXT_SUMMARY: ${JSON.stringify(payload.contextSummaries || {})}`
        ),
        this.createSystemMessage(
          `PERSONALIZATION_SIGNALS: ${JSON.stringify({
            source: payload.source,
            budgetHint: payload.budgetHint,
            topOrderProducts: payload.topOrderProducts,
            signals: payload.signals
          })}`
        )
      ];

      const orderToon = payload?.toonContext?.orderDataToon?.encoded;
      const surveyToon = payload?.toonContext?.surveyDataToon?.encoded;
      const profileToon = payload?.toonContext?.profileDataToon?.encoded;

      if (orderToon)
        messages.push(
          this.createSystemMessage(`ORDER_CONTEXT_TOON: ${orderToon}`)
        );
      if (surveyToon)
        messages.push(
          this.createSystemMessage(`SURVEY_CONTEXT_TOON: ${surveyToon}`)
        );
      if (profileToon)
        messages.push(
          this.createSystemMessage(`PROFILE_CONTEXT_TOON: ${profileToon}`)
        );

      return messages;
    } catch (error) {
      this.logger.warn(
        `[AIPersonalizationHelper] Failed to build TOON context: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  private createSystemMessage(text: string): UIMessage {
    return {
      id: uuid(),
      role: 'system',
      parts: [{ type: 'text', text }]
    };
  }
}
