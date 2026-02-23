/**
 * Controller-level prompt functions
 * Các prompt được sử dụng trong controller layer
 */

// ==================== Conversation Prompts ====================

/**
 * Prompt chứa log hoạt động của người dùng để AI tham khảo
 */
export const userLogPrompt = (data: string): string =>
  `Dưới đây là một số nhật ký hoạt động gần đây của bạn có thể liên quan đến cuộc trò chuyện của chúng ta:\n${data}\nHãy sử dụng thông tin này để đưa ra phản hồi chính xác và cá nhân hoá hơn. Nếu nhật ký không liên quan, bạn có thể bỏ qua.`;

/**
 * Prompt kết hợp system prompt, user log và order report cho conversation test
 */
export const orderReportPrompt = (orderReport: string): string =>
  `Ngoài ra, dưới đây là tóm tắt các đơn hàng gần đây của bạn có thể liên quan đến cuộc trò chuyện:\n${orderReport}\nHãy sử dụng thông tin này để đưa ra phản hồi chính xác và cá nhân hoá hơn. Nếu thông tin đơn hàng không liên quan, bạn có thể bỏ qua.`;

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
  `Dựa trên nhật ký hoạt động người dùng được tóm tắt dưới đây, hãy xác định các xu hướng và mô hình nổi bật có thể định hướng cho chiến lược phát triển sản phẩm và marketing trong tương lai. Cung cấp những nhận định về hành vi người dùng, sở thích và các cơ hội thị trường tiềm năng:\n${summaryData}`;

// ==================== Review Prompts ====================

/**
 * Prompt tóm tắt đánh giá sản phẩm
 */
export const reviewSummaryPrompt = (reviewsText: string): string =>
  `Hãy tóm tắt các đánh giá sản phẩm sau đây, làm nổi bật các điểm quan trọng như những lời khen phổ biến, khiếu nại thường gặp và cảm nhận chung. Cung cấp nhận định có thể giúp cải thiện sản phẩm hoặc hỗ trợ người mua tiềm năng:\n${reviewsText}`;

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
  `Hãy tạo một bản tóm tắt toàn diện về thông tin đơn hàng sau đây, làm nổi bật các nhận định quan trọng như mô hình mua sắm, sản phẩm được đặt thường xuyên và các xu hướng đáng chú ý có thể định hướng cho chiến lược kinh doanh trong tương lai:\n\n${orderDetails}`;

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
  `Hãy tạo một báo cáo tồn kho ngắn gọn dựa trên dữ liệu sau:\n\n${reportData}`;

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