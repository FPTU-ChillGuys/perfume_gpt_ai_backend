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
  orderSummaryPrompt
} from './controller.prompt';

// Service prompts
export {
  generateSummaryPrompt,
  convertQuesAnsesToString,
  quizPrompt
} from './service.prompt';
