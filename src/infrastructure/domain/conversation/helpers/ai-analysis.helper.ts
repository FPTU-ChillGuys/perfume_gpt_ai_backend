import { Injectable, Logger } from '@nestjs/common';
import { AnalysisObject } from 'src/chatbot/output/analysis.output';
import { AiAnalysisService } from 'src/infrastructure/domain/ai/ai-analysis.service';

/**
 * Helper xử lý việc phân tích ý định người dùng thông qua AI.
 */
@Injectable()
export class AIAnalysisHelper {
  private static readonly BUDGET_KEYWORD_PATTERN =
    /\b(dưới|trên|từ|đến|khoảng|gần|cao nhất|thấp nhất|trên dưới|xấp xỉ)\s*\d+[\s,.]*(triệu|nghìn|ngàn|k|m|tr)\b/i;

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
      pagination: { pageNumber: 1, pageSize: 15 },
      originalRequestVietnamese: messageText,
      normalizationMetadata: null,
      explanation: 'Fallback analysis because intermediate analysis failed'
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

  /** Loại bỏ các từ khóa ngân sách khỏi logic — chỉ giữ trong budget field */
  private stripBudgetKeywordsFromLogic(
    logic: (string | string[])[] | null
  ): (string | string[])[] {
    if (!logic || logic.length === 0) return logic || [];

    return logic
      .map((group) => {
        if (typeof group === 'string') {
          if (AIAnalysisHelper.BUDGET_KEYWORD_PATTERN.test(group)) {
            this.logger.debug(
              `[AIAnalysisHelper] Stripped budget keyword from logic: "${group}"`
            );
            return null;
          }
          return group;
        }
        if (Array.isArray(group)) {
          const filtered = group.filter((item) => {
            if (AIAnalysisHelper.BUDGET_KEYWORD_PATTERN.test(item)) {
              this.logger.debug(
                `[AIAnalysisHelper] Stripped budget keyword from logic: "${item}"`
              );
              return false;
            }
            return true;
          });
          return filtered.length > 0 ? filtered : null;
        }
        return group;
      })
      .filter((g): g is string | string[] => g !== null);
  }

  /**
   * Rebuild logic groups from normalizationMetadata when logic is empty or
   * only contains budget-like keywords that were stripped.
   * This ensures brand/category/note keywords aren't lost when AI puts them
   * in normalizationMetadata but not in logic.
   */
  private rebuildLogicFromMetadata(
    analysis: AnalysisObject
  ): (string | string[])[] | null {
    const metadata = analysis.normalizationMetadata;
    if (!Array.isArray(metadata) || metadata.length === 0) return null;

    const BUDGET_TYPES = new Set(['budget', 'price', 'priceRange']);
    const GENDER_TYPES = new Set(['gender']);
    const VALID_TYPES = new Set([
      'brand',
      'category',
      'note',
      'family',
      'product',
      'attribute'
    ]);

    const groupsByType = new Map<string, string[]>();
    for (const entry of metadata) {
      const type = entry.type?.toLowerCase() || '';
      if (
        BUDGET_TYPES.has(type) ||
        GENDER_TYPES.has(type) ||
        !VALID_TYPES.has(type)
      )
        continue;

      const keyword = entry.corrected || entry.original;
      if (!keyword) continue;

      if (!groupsByType.has(type)) {
        groupsByType.set(type, []);
      }
      groupsByType.get(type)!.push(keyword);
    }

    if (groupsByType.size === 0) return null;

    const logicGroups: (string | string[])[] = [];
    for (const values of groupsByType.values()) {
      if (values.length === 1) {
        logicGroups.push(values[0]);
      } else {
        logicGroups.push(values);
      }
    }

    return logicGroups.length > 0 ? logicGroups : null;
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

    let result: AnalysisObject = {
      ...analysis,
      queries: queries.length > 0 ? queries : null,
      functionCall: analysis.functionCall || null,
      logic: Array.isArray(analysis.logic) ? analysis.logic : [],
      productNames:
        normalizedProductNames.length > 0 ? normalizedProductNames : null,
      pagination: analysis.pagination || { pageNumber: 1, pageSize: 15 }
    };

    // Strip budget keywords from logic — they belong in budget field, not search
    for (const query of result.queries || []) {
      if (query.logic) {
        query.logic = this.stripBudgetKeywordsFromLogic(query.logic);
      }
      // Rebuild logic from normalizationMetadata if logic is now empty
      if (!query.logic || query.logic.length === 0) {
        const rebuiltLogic = this.rebuildLogicFromMetadata(analysis);
        if (rebuiltLogic && rebuiltLogic.length > 0) {
          this.logger.log(
            `[AIAnalysisHelper] Logic empty after budget strip, rebuilt from metadata: ${JSON.stringify(rebuiltLogic)}`
          );
          query.logic = rebuiltLogic;
        }
      }
    }

    const strippedLogic = this.stripBudgetKeywordsFromLogic(
      Array.isArray(result.logic) ? result.logic : []
    );
    // Rebuild from metadata if logic became empty
    result.logic =
      strippedLogic.length > 0
        ? strippedLogic
        : this.rebuildLogicFromMetadata(analysis) || [];

    return result;
  }
}
