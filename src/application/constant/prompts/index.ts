/**
 * Prompt constants barrel export
 * Tập trung export tất cả các prompt từ một nơi
 */

// System prompts
export {
  SYSTEM_PROMPT,
  PROMPT_OPTIMIZATION_SYSTEM_PROMPT,
  CONVERSATION_ANALYSIS_SYSTEM_PROMPT,
  INTENT_ONLY_ANALYSIS_SYSTEM_PROMPT,
  SURVEY_ANALYSIS_SYSTEM_PROMPT,
  TREND_ANALYSIS_SYSTEM_PROMPT,
  STAFF_CONSULTATION_SYSTEM_PROMPT,
} from './system.prompt';

// Controller prompts
export {
  userLogPrompt,
  orderReportPrompt,
  conversationSystemPrompt,
  conversationTestSystemPrompt,
  trendForecastingPrompt,
  reviewSummaryPrompt,
  repurchaseRecommendationPrompt,
  aiRecommendationPrompt,
  orderSummaryPrompt,
  inventoryReportPrompt,
  recommendationReportPrompt,
  recommendationSummaryPrompt,
  surveyContextPrompt,
  surveyProductContextPrompt,
  surveyRecommendationSystemPrompt
} from './controller.prompt';

// Service prompts
export {
  generateSummaryPrompt,
  convertQuesAnsesToString,
  surveyPrompt
} from './service.prompt';

// Admin instruction type constants
export {
  INSTRUCTION_TYPE_REVIEW,
  INSTRUCTION_TYPE_ORDER,
  INSTRUCTION_TYPE_INVENTORY,
  INSTRUCTION_TYPE_TREND,
  INSTRUCTION_TYPE_RECOMMENDATION,
  INSTRUCTION_TYPE_REPURCHASE,
  INSTRUCTION_TYPE_LOG,
  INSTRUCTION_TYPE_CONVERSATION,
  INSTRUCTION_TYPE_SURVEY,
  INSTRUCTION_TYPE_RESTOCK,
  INSTRUCTION_TYPE_SLOW_STOCK,
  INSTRUCTION_TYPE_STAFF_CONSULTATION,
  ALL_INSTRUCTION_TYPES
} from './admin-instruction-types';
export type { InstructionDomainType } from './admin-instruction-types';
