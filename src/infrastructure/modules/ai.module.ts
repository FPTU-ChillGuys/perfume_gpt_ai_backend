import { SYSTEM_PROMPT } from 'src/application/constant/prompts';
import { AIHelper } from '../helpers/ai.helper';
import { Tools } from 'src/chatbot/utils/tools';
import { Module, Provider } from '@nestjs/common';
import { UnitOfWorkModule } from './unit-of-work.module';
import { ToolModule } from './tool.module';

export const AI_HELPER = 'AI_HELPER';
export const AI_CONVERSATION_HELPER = 'AI_CONVERSATION_HELPER';
export const AI_TREND_HELPER = 'AI_TREND_HELPER';
export const AI_RECOMMENDATION_HELPER = 'AI_RECOMMENDATION_HELPER';
export const AI_RESTOCK_HELPER = 'AI_RESTOCK_HELPER';
export const AI_QUIZ_HELPER = 'AI_QUIZ_HELPER';
export const AI_INVENTORY_REPORT_HELPER = 'AI_INVENTORY_REPORT_HELPER';
export const AI_REVIEW_HELPER = 'AI_REVIEW_HELPER';

// Backward-compat aliases (old token name → same string value as new)
export const AI_SERVICE = AI_HELPER;
export const AI_CONVERSATION_SERVICE = AI_CONVERSATION_HELPER;
export const AI_TREND_SERVICE = AI_TREND_HELPER;
export const AI_RECOMMENDATION_AND_REPURCHASE_SERVICE =
  AI_RECOMMENDATION_HELPER;
export const AI_RESTOCK_SERVICE = AI_RESTOCK_HELPER;

const aiProvider: Provider = {
  provide: AI_HELPER,
  useFactory: (tools: Tools) => new AIHelper(SYSTEM_PROMPT, tools.getTools, 10),
  inject: [Tools]
};

const aiConversationProvider: Provider = {
  provide: AI_CONVERSATION_HELPER,
  useFactory: (tools: Tools) =>
    new AIHelper(SYSTEM_PROMPT, tools.getToolsForChatbot, 10),
  inject: [Tools]
};

const aiTrendProvider: Provider = {
  provide: AI_TREND_HELPER,
  useFactory: (tools: Tools) =>
    new AIHelper(SYSTEM_PROMPT, tools.getToolsForTrend, 10),
  inject: [Tools]
};

const aiRecommendationProvider: Provider = {
  provide: AI_RECOMMENDATION_HELPER,
  useFactory: (tools: Tools) =>
    new AIHelper(
      SYSTEM_PROMPT,
      tools.getToolsForRecomendationAndRepurchase,
      10
    ),
  inject: [Tools]
};

const aiRestockProvider: Provider = {
  provide: AI_RESTOCK_HELPER,
  useFactory: (tools: Tools) =>
    new AIHelper(SYSTEM_PROMPT, tools.getToolsForRestock, 10, 0),
  inject: [Tools]
};

const aiQuizProvider: Provider = {
  provide: AI_QUIZ_HELPER,
  useFactory: (tools: Tools) =>
    new AIHelper(
      SYSTEM_PROMPT,
      tools.getToolsForQuiz,
      10,
      undefined,
    ),
  inject: [Tools]
};

const aiReviewProvider: Provider = {
  provide: AI_REVIEW_HELPER,
  useFactory: (tools: Tools) =>
    new AIHelper(
      SYSTEM_PROMPT,
      tools.getToolsForReview,
      10,
      undefined,
    ),
  inject: [Tools]
};


const aiInventoryReportProvider: Provider = {
  provide: AI_INVENTORY_REPORT_HELPER,
  useFactory: (tools: Tools) =>
    new AIHelper(
      SYSTEM_PROMPT,
      tools.getToolsForInventoryReport,
      10,
      undefined
    ),
  inject: [Tools]
};

@Module({
  imports: [UnitOfWorkModule, ToolModule],
  providers: [
    aiProvider,
    aiConversationProvider,
    aiTrendProvider,
    aiRecommendationProvider,
    aiRestockProvider,
    aiQuizProvider,
    aiInventoryReportProvider
  ],
  exports: [
    aiProvider,
    aiConversationProvider,
    aiTrendProvider,
    aiRecommendationProvider,
    aiRestockProvider,
    aiQuizProvider,
    aiInventoryReportProvider
  ]
})
export class AIModule {}
