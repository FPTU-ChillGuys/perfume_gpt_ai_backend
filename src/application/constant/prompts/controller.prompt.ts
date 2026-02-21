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
 * Prompt kết hợp system prompt với cac prompt khac
 */
export const conversationSystemPrompt = (
  systemPrompt: string,
  otherPrompts: string
): string => `${systemPrompt} \n ${otherPrompts}`;

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
 * Prompt gợi ý mua lại sản phẩm - viết theo giọng email thân thiện, tự nhiên
 */
export const repurchaseRecommendationPrompt = (summaryData: string): string =>
  `Dựa trên thông tin sau của người dùng:\n${summaryData}\n\nHãy viết gợi ý mua lại nước hoa theo phong cách tự nhiên, thân thiện như một người bạn am hiểu về nước hoa đang gửi email gợi ý cá nhân. Giới thiệu 3-5 sản phẩm phù hợp với lý do cụ thể, gần gũi, dễ đọc. KHÔNG hỏi câu hỏi ngược lại, KHÔNG đề nghị làm thêm quiz.`;

/**
 * Prompt tạo tóm tắt đơn hàng bằng AI
 */
export const orderSummaryPrompt = (orderDetails: string): string =>
  `Generate a comprehensive summary of the following order details, highlighting key insights such as purchasing patterns, frequently ordered items, and any notable trends that could inform future business strategies:\n\n${orderDetails}`;

/**
 * Prompt gợi ý AI dựa trên log người dùng - viết theo giọng tư vấn tự nhiên
 */
export const aiRecommendationPrompt = (summaryData: string): string =>
  `Dựa trên thông tin sau của người dùng:\n${summaryData}\n\nHãy đưa ra gợi ý nước hoa cá nhân hoá theo giọng văn tự nhiên, thân thiện như một chuyên gia tư vấn đang nói chuyện trực tiếp. Giải thích vì sao từng sản phẩm phù hợp với sở thích và phong cách của người dùng. KHÔNG hỏi câu hỏi ngược lại, KHÔNG đề nghị làm thêm quiz.`;

// ==================== Inventory Prompts ====================

/**
 * Prompt tạo báo cáo tồn kho bằng AI
 */
export const inventoryReportPrompt = (reportData: string): string =>
  `Generate a concise inventory report based on the following data:\n\n${reportData}`;

// ==================== Recommendation Inline Prompts ====================

/**
 * Prompt phân tích report để đưa ra đề xuất cho người dùng
 */
export const recommendationReportPrompt = (reportPrompt: string): string =>
  `Từ dữ liệu sau: ${reportPrompt}\n\nHãy đưa ra gợi ý nước hoa phù hợp theo giọng văn thân thiện, tự nhiên. Không dùng ngôn ngữ kỹ thuật, không hỏi ngược lại người dùng.`;

/**
 * Prompt dự đoán và tóm tắt hành vi, sở thích người dùng từ summary report
 */
export const recommendationSummaryPrompt = (summaryReportPrompt: string): string =>
  `Từ dữ liệu sau: ${summaryReportPrompt}\n\nHãy tóm tắt ngắn gọn sở thích và hành vi của người dùng theo ngôn ngữ tự nhiên, đơn giản. Dùng làm cơ sở để gợi ý nước hoa phù hợp.`;


export const adminTokenPrompt = (prompt: string): string => `${prompt}`;