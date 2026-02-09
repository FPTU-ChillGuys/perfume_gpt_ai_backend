/**
 * Controller-level prompt functions
 * Các prompt được sử dụng trong controller layer
 */

// ==================== Conversation Prompts ====================

/**
 * Prompt chứa log hoạt động của người dùng để AI tham khảo
 */
export const userLogPrompt = (data: string): string =>
  `Here are some of your recent activity logs that might be relevant to our conversation:\n${data}\nUse this information to provide more accurate and personalized responses. If the logs are not relevant, you can ignore them.`;

/**
 * Prompt kết hợp system prompt, user log và order report cho conversation test
 */
export const orderReportPrompt = (orderReport: string): string =>
  `Additionally, here is a summary of your recent orders that might be relevant to our conversation:\n${orderReport}\n Use this information to provide more accurate and personalized responses. If the order information is not relevant, you can ignore it.`;

/**
 * Prompt kết hợp system prompt với user log prompt
 */
export const conversationSystemPrompt = (
  systemPrompt: string,
  userLogPromptText: string
): string => `${systemPrompt} \n ${userLogPromptText}`;

/**
 * Prompt kết hợp system prompt, user log và order report
 */
export const conversationTestSystemPrompt = (
  systemPrompt: string,
  userLogPromptText: string,
  orderReportText: string
): string =>
  `${systemPrompt} \n ${userLogPromptText} \n ${orderReportText}`;

// ==================== Trend Prompts ====================

/**
 * Prompt dự đoán xu hướng dựa trên tóm tắt log người dùng
 */
export const trendForecastingPrompt = (summaryData: string): string =>
  `Based on the following summarized user logs, identify emerging trends and patterns that could inform future product development and marketing strategies. Provide insights into user behavior, preferences, and potential market opportunities:\n${summaryData}`;

// ==================== Review Prompts ====================

/**
 * Prompt tóm tắt đánh giá sản phẩm
 */
export const reviewSummaryPrompt = (reviewsText: string): string =>
  `Summarize the following product reviews, highlighting key points such as common praises, frequent complaints, and overall sentiment. Provide insights that could help improve the product or inform potential buyers:\n${reviewsText}`;

// ==================== Recommendation Prompts ====================

/**
 * Prompt gợi ý mua lại sản phẩm
 */
export const repurchaseRecommendationPrompt = (summaryData: string): string =>
  `Based on the following summarized user logs, provide personalized repurchase recommendations for products the users have shown interest in. Consider their preferences, past interactions, and any emerging trends that could influence their purchasing decisions:\n${summaryData}`;

/**
 * Prompt gợi ý AI dựa trên log người dùng
 */
export const aiRecommendationPrompt = (summaryData: string): string =>
  `Based on the following summarized user logs, provide personalized AI-driven recommendations for products or services that align with the users' interests and preferences. Consider their past interactions, preferences, and any emerging trends that could enhance their experience:\n${summaryData}`;
