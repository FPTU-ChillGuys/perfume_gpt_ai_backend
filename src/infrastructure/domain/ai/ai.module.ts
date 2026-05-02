import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module, Provider } from '@nestjs/common';
import { AiAnalysisService } from 'src/infrastructure/domain/ai/ai-analysis.service';
import { RerankService } from 'src/infrastructure/domain/ai/rerank.service';
import { SYSTEM_PROMPT } from 'src/application/constant/prompts';
import { AIHelper } from 'src/infrastructure/domain/helpers/ai.helper';
import { Tools } from 'src/chatbot/tools';
import { UnitOfWorkModule } from 'src/infrastructure/domain/common/unit-of-work.module';
import { ToolModule } from 'src/infrastructure/domain/ai/tool.module';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';
import { PromptLoaderService } from 'src/infrastructure/domain/utils/prompt-loader.service';
import {
  aiModelForSurvey,
  aiModelForRestock,
  aiModelForReview,
  aiModelForTrend
} from 'src/chatbot/ai-model';
export const AI_HELPER = 'AI_HELPER';
export const AI_CONVERSATION_HELPER = 'AI_CONVERSATION_HELPER';
export const AI_TREND_HELPER = 'AI_TREND_HELPER';
export const AI_RECOMMENDATION_HELPER = 'AI_RECOMMENDATION_HELPER';
export const AI_RESTOCK_HELPER = 'AI_RESTOCK_HELPER';
export const AI_SURVEY_HELPER = 'AI_SURVEY_HELPER';
export const AI_INVENTORY_REPORT_HELPER = 'AI_INVENTORY_REPORT_HELPER';
export const AI_REVIEW_HELPER = 'AI_REVIEW_HELPER';
export const AI_STAFF_CONVERSATION_HELPER = 'AI_STAFF_CONVERSATION_HELPER';

// Backward-compat aliases (old token name → same string value as new)
export const AI_SERVICE = AI_HELPER;
export const AI_CONVERSATION_SERVICE = AI_CONVERSATION_HELPER;
export const AI_TREND_SERVICE = AI_TREND_HELPER;
export const AI_RECOMMENDATION_AND_REPURCHASE_SERVICE =
  AI_RECOMMENDATION_HELPER;
export const AI_RESTOCK_SERVICE = AI_RESTOCK_HELPER;

const aiProvider: Provider = {
  provide: AI_HELPER,
  useFactory: (
    tools: Tools,
    err: I18nErrorHandler,
    promptLoader: PromptLoaderService
  ) =>
    new AIHelper(
      SYSTEM_PROMPT,
      () => tools.getTools,
      10,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      err,
      promptLoader
    ),
  inject: [Tools, I18nErrorHandler, PromptLoaderService]
};

const aiConversationProvider: Provider = {
  provide: AI_CONVERSATION_HELPER,
  useFactory: (
    tools: Tools,
    err: I18nErrorHandler,
    promptLoader: PromptLoaderService
  ) =>
    new AIHelper(
      SYSTEM_PROMPT,
      () => tools.getToolsForChatbot,
      10,
      undefined,
      undefined,
      undefined,
      {
        enablePromptOptimization: true,
        optimizationPrompt:
          'Use case: conversation tu van nuoc hoa. Giu nguyen intent cua nguoi dung, khong doi sang domain khac. Neu user dang yeu cau tim/goi y san pham thi giu cau truc de model chinh co the goi tool va tra ve dung format.'
      },
      undefined,
      err,
      promptLoader
    ),
  inject: [Tools, I18nErrorHandler, PromptLoaderService]
};

const aiStaffConversationProvider: Provider = {
  provide: AI_STAFF_CONVERSATION_HELPER,
  useFactory: (
    tools: Tools,
    err: I18nErrorHandler,
    promptLoader: PromptLoaderService
  ) =>
    new AIHelper(
      SYSTEM_PROMPT,
      () => tools.getToolsForStaffChatbot,
      10,
      undefined,
      undefined,
      undefined,
      {
        enablePromptOptimization: true,
        optimizationPrompt:
          'Use case: STAFF ASSISTANT conversation. Helping staff with quick counter consultations. Precise, fact-based, bullet points.'
      },
      undefined,
      err,
      promptLoader
    ),
  inject: [Tools, I18nErrorHandler, PromptLoaderService]
};

const aiTrendProvider: Provider = {
  provide: AI_TREND_HELPER,
  useFactory: (
    tools: Tools,
    err: I18nErrorHandler,
    promptLoader: PromptLoaderService
  ) =>
    new AIHelper(
      SYSTEM_PROMPT,
      () => tools.getToolsForAnalysis,
      10,
      undefined,
      undefined,
      aiModelForTrend,
      undefined,
      undefined,
      err,
      promptLoader
    ),
  inject: [Tools, I18nErrorHandler, PromptLoaderService]
};

const aiRecommendationProvider: Provider = {
  provide: AI_RECOMMENDATION_HELPER,
  useFactory: (
    tools: Tools,
    err: I18nErrorHandler,
    promptLoader: PromptLoaderService
  ) =>
    new AIHelper(
      SYSTEM_PROMPT,
      undefined,
      10,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      err,
      promptLoader
    ),
  inject: [Tools, I18nErrorHandler, PromptLoaderService]
};

const aiRestockProvider: Provider = {
  provide: AI_RESTOCK_HELPER,
  useFactory: (
    tools: Tools,
    err: I18nErrorHandler,
    promptLoader: PromptLoaderService
  ) =>
    new AIHelper(
      SYSTEM_PROMPT,
      () => tools.getToolsForRestock,
      10,
      0,
      'auto',
      aiModelForRestock,
      undefined,
      300000,
      err,
      promptLoader
    ),
  inject: [Tools, I18nErrorHandler, PromptLoaderService]
};

const aiSurveyProvider: Provider = {
  provide: AI_SURVEY_HELPER,
  useFactory: (
    tools: Tools,
    err: I18nErrorHandler,
    promptLoader: PromptLoaderService
  ) =>
    new AIHelper(
      SYSTEM_PROMPT,
      () => tools.getToolsForSurvey,
      10,
      0,
      'auto',
      aiModelForSurvey,
      undefined,
      undefined,
      err,
      promptLoader
    ),
  inject: [Tools, I18nErrorHandler, PromptLoaderService]
};

const aiReviewProvider: Provider = {
  provide: AI_REVIEW_HELPER,
  useFactory: (
    tools: Tools,
    err: I18nErrorHandler,
    promptLoader: PromptLoaderService
  ) =>
    new AIHelper(
      SYSTEM_PROMPT,
      undefined,
      10,
      0,
      undefined,
      aiModelForReview,
      undefined,
      undefined,
      err,
      promptLoader
    ),
  inject: [Tools, I18nErrorHandler, PromptLoaderService]
};

const aiInventoryReportProvider: Provider = {
  provide: AI_INVENTORY_REPORT_HELPER,
  useFactory: (
    tools: Tools,
    err: I18nErrorHandler,
    promptLoader: PromptLoaderService
  ) =>
    new AIHelper(
      SYSTEM_PROMPT,
      () => tools.getToolsForInventoryReport,
      10,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      err,
      promptLoader
    ),
  inject: [Tools, I18nErrorHandler, PromptLoaderService]
};

@Module({
  imports: [UnitOfWorkModule, ToolModule, HttpModule],
  providers: [
    AiAnalysisService,
    RerankService,
    aiProvider,
    aiConversationProvider,
    aiTrendProvider,
    aiRecommendationProvider,
    aiRestockProvider,
    aiSurveyProvider,
    aiInventoryReportProvider,
    aiReviewProvider,
    aiStaffConversationProvider
  ],
  exports: [
    AiAnalysisService,
    RerankService,
    aiProvider,
    aiConversationProvider,
    aiTrendProvider,
    aiRecommendationProvider,
    aiRestockProvider,
    aiSurveyProvider,
    aiInventoryReportProvider,
    aiReviewProvider,
    aiStaffConversationProvider
  ]
})
export class AIModule {}
