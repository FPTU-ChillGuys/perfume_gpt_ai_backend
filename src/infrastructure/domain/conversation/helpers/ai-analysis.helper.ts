import { Injectable, Logger } from '@nestjs/common';
import { AnalysisObject } from 'src/chatbot/output/analysis.output';
import { AiAnalysisService } from 'src/infrastructure/domain/ai/ai-analysis.service';

/**
 * Helper xử lý việc phân tích ý định người dùng thông qua AI.
 */
@Injectable()
export class AIAnalysisHelper {
  private readonly logger = new Logger(AIAnalysisHelper.name);

  constructor(private readonly analysisService: AiAnalysisService) {}

  /**
   * Phân tích tin nhắn người dùng.
   */
  async analyze(
    messageText: string,
    previousContext: string,
    options: { userId: string; isGuestUser: boolean; isStaff: boolean }
  ): Promise<AnalysisObject> {
    this.logger.log(
      `[AIAnalysisHelper] Running analysis for: "${messageText.substring(0, 50)}..."`
    );

    const rawAnalysis = await this.analysisService.analyze(
      messageText,
      previousContext,
      options
    );

    if (!rawAnalysis) {
      this.logger.warn('[AIAnalysisHelper] Analysis failed, using fallback.');
      return this.createFallbackAnalysis(messageText);
    }

    return this.normalizeAnalysisForQuery(rawAnalysis);
  }

  /** Tạo phân tích dự phòng khi AI không phản hồi đúng */
  private createFallbackAnalysis(messageText: string): AnalysisObject {
    return {
      intent: 'Chat',
      queries: null,
      logic: [],
      productNames: null,
      sorting: null,
      budget: null,
      functionCall: null,
      pagination: { pageNumber: 1, pageSize: 5 },
      originalRequestVietnamese: messageText,
      normalizationMetadata: null,
      explanation: 'Fallback analysis because intermediate analysis failed'
    };
  }

  /** Chuẩn hóa kết quả phân tích */
  private normalizeAnalysisForQuery(analysis: AnalysisObject): AnalysisObject {
    let queries = Array.isArray(analysis.queries) ? analysis.queries : [];

    // Fallback 1: Nếu không có queries nhưng có legacy logic/productNames (Search Intent)
    if (
      queries.length === 0 &&
      ['Search', 'Consult', 'Recommend', 'Compare'].includes(analysis.intent)
    ) {
      queries.push({
        purpose: 'search',
        logic: analysis.logic || [],
        productNames: analysis.productNames || null,
        sorting: analysis.sorting || null,
        budget: analysis.budget || null,
        functionCall: null,
        profileHint: null
      });
    }

    // Fallback 2: Nếu không có queries nhưng có legacy functionCall (Task/Function Intent)
    if (queries.length === 0 && analysis.functionCall) {
      this.logger.log(
        `[AIAnalysisHelper] Migrating legacy functionCall to queries: ${analysis.functionCall.name}`
      );
      queries.push({
        purpose: 'function',
        logic: analysis.logic || [],
        productNames: null,
        sorting: null,
        budget: null,
        functionCall: analysis.functionCall,
        profileHint: null
      });
    }

    const normalizedProductNames = Array.isArray(analysis.productNames)
      ? Array.from(new Set(analysis.productNames)).slice(0, 8)
      : [];

    return {
      ...analysis,
      queries: queries.length > 0 ? queries : null,
      functionCall: analysis.functionCall || null,
      logic: Array.isArray(analysis.logic) ? analysis.logic : [],
      productNames:
        normalizedProductNames.length > 0 ? normalizedProductNames : null,
      pagination: analysis.pagination || { pageNumber: 1, pageSize: 5 }
    };
  }

  /** Kiểm tra cờ (flag) trong giải thích của AI */
  hasAnalysisFlag(analysis: AnalysisObject, flag: string): boolean {
    const explanation = (analysis.explanation || '').toUpperCase();
    return explanation.includes(flag.toUpperCase());
  }

  /** Kiểm tra xem có phải luồng truy vấn khách quan hoặc tặng quà không */
  isObjectiveOrGiftFlow(analysis: AnalysisObject): boolean {
    return (
      this.hasAnalysisFlag(analysis, 'PURE_TREND_QUERY') ||
      this.hasAnalysisFlag(analysis, 'OBJECTIVE_CATALOG_QUERY') ||
      this.hasAnalysisFlag(analysis, 'GIFT_INTENT')
    );
  }
}
