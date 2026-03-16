/**
 * Controller-level prompt functions
 * Các prompt được sử dụng trong controller layer.
 *
 * NGUYÊN TẮC THIẾT KẾ:
 * - Controller prompt CHỈ đóng gói DỮ LIỆU (data wrapper / context provider).
 * - Mọi hướng dẫn hành vi, format, quy tắc phải đặt trong Admin Instruction (DB).
 * - Khi admin thay đổi instruction trong DB → AI thay đổi hành vi ngay, không cần deploy lại.
 */

// ==================== Conversation Prompts ====================

/**
 * Cung cấp context: nhật ký hoạt động gần đây của người dùng
 */
export const userLogPrompt = (data: string): string =>
  `[DỮ LIỆU NHẬT KÝ HOẠT ĐỘNG NGƯỜI DÙNG]\n${data}`;

/**
 * Cung cấp context: tóm tắt đơn hàng gần đây của người dùng
 */
export const orderReportPrompt = (orderReport: string): string =>
  `[DỮ LIỆU ĐƠN HÀNG GẦN ĐÂY]\n${orderReport}`;

/**
 * Kết hợp system prompt với các context prompt khác
 */
export const conversationSystemPrompt = (
  systemPrompt: string,
  otherPrompts: string
): string => `${systemPrompt}\n${otherPrompts}`;

/**
 * Kết hợp system prompt, user log context và order context cho conversation
 */
export const conversationTestSystemPrompt = (
  systemPrompt: string,
  userLogPromptText: string,
  orderReportText: string
): string =>
  `${systemPrompt}\n${userLogPromptText}\n${orderReportText}`;

// ==================== Trend Prompts ====================

/**
 * Cung cấp context: dữ liệu tóm tắt log người dùng để phân tích xu hướng.
 * Hành vi phân tích và quy tắc dùng tool được điều khiển hoàn toàn
 * bởi Admin Instruction domain "trend" trong DB.
 */
export const trendForecastingPrompt = (summaryData: string): string =>
  `[DỮ LIỆU NHẬT KÝ NGƯỜI DÙNG ĐỂ PHÂN TÍCH XU HƯỚNG]\n${summaryData}`;

// ==================== Review Prompts ====================

/**
 * Cung cấp context: nội dung các đánh giá sản phẩm cần tóm tắt.
 * Hành vi tóm tắt được điều khiển bởi Admin Instruction domain "review".
 */
export const reviewSummaryPrompt = (reviewsText: string): string =>
  `[DỮ LIỆU ĐÁNH GIÁ SẢN PHẨM]\n${reviewsText}`;

// ==================== Recommendation Prompts ====================

/**
 * Cung cấp context: thông tin người dùng để gợi ý mua lại.
 * Hành vi gợi ý được điều khiển bởi Admin Instruction domain "recommendation".
 */
export const repurchaseRecommendationPrompt = (summaryData: string): string =>
  `[DỮ LIỆU NGƯỜI DÙNG ĐỂ GỢI Ý MUA LẠI]\n${summaryData}`;

/**
 * Cung cấp context: tóm tắt đơn hàng để tạo báo cáo AI.
 * Hành vi phân tích được điều khiển bởi Admin Instruction domain "order".
 */
export const orderSummaryPrompt = (orderDetails: string): string =>
  `[DỮ LIỆU ĐƠN HÀNG CẦN PHÂN TÍCH]\n${orderDetails}`;

/**
 * Cung cấp context: thông tin người dùng để gợi ý sản phẩm AI.
 * Hành vi gợi ý được điều khiển bởi Admin Instruction domain "recommendation".
 */
export const aiRecommendationPrompt = (summaryData: string): string =>
  `[DỮ LIỆU NGƯỜI DÙNG ĐỂ GỢI Ý SẢN PHẨM]\n${summaryData}`;

// ==================== Inventory Prompts ====================

/**
 * Cung cấp context: dữ liệu tồn kho để tạo báo cáo AI.
 * Hành vi báo cáo được điều khiển bởi Admin Instruction domain "inventory".
 */
export const inventoryReportPrompt = (reportData: string): string =>
  `[DỮ LIỆU TỒN KHO CẦN BÁO CÁO]\n${reportData}`;

// ==================== Recommendation Inline Prompts ====================

/**
 * Cung cấp context: report data để AI đưa ra gợi ý sản phẩm inline.
 * Hành vi được điều khiển bởi Admin Instruction domain "recommendation".
 */
export const recommendationReportPrompt = (reportPrompt: string): string =>
  `[DỮ LIỆU REPORT ĐỂ GỢI Ý SẢN PHẨM]\n${reportPrompt}`;

/**
 * Cung cấp context: summary report để tóm tắt sở thích người dùng.
 * Hành vi được điều khiển bởi Admin Instruction domain "recommendation".
 */
export const recommendationSummaryPrompt = (summaryReportPrompt: string): string =>
  `[DỮ LIỆU TÓM TẮT HÀNH VI NGƯỜI DÙNG]\n${summaryReportPrompt}`;

/**
 * Pass-through: trả về chính prompt đã được build sẵn từ prompt-builder.
 */
export const adminTokenPrompt = (prompt: string): string => `${prompt}`;