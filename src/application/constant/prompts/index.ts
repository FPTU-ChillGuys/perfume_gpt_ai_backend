/**
 * Prompt constants barrel export
 * Tập trung export tất cả các prompt từ một nơi
 */

// System prompts
export {
  SYSTEM_PROMPT,
  CHATBOT_SYSTEM_PROMPT,
  QUIZ_SYSTEM_PROMPT,
  ADVANCED_MATCHING_SYSTEM_PROMPT
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
  recommendationSummaryPrompt
} from './controller.prompt';

// Service prompts
export {
  generateSummaryPrompt,
  convertQuesAnsesToString,
  quizPrompt
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
  ALL_INSTRUCTION_TYPES
} from './admin-instruction-types';
export type { InstructionDomainType } from './admin-instruction-types';
