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
 * Yêu cầu AI trả về báo cáo xu hướng chuyên nghiệp kèm danh sách sản phẩm trending
 */
export const trendForecastingPrompt = (summaryData: string): string =>
  `BẠN LÀ CHUYÊN GIA PHÂN TÍCH XU HƯỚNG THỊ TRƯỜNG NƯỚC HOA. Dựa trên dữ liệu nhật ký hoạt động người dùng bên dưới, hãy tạo BÁO CÁO XU HƯỚNG CHUYÊN NGHIỆP với cấu trúc sau:

📊 DỮ LIỆU PHÂN TÍCH:
${summaryData}

📋 YÊU CẦU BÁO CÁO (BẮT BUỘC tuân theo):

1. **TỔNG QUAN XU HƯỚNG**: Tóm tắt ngắn gọn (3-5 câu) về xu hướng nổi bật nhất từ dữ liệu người dùng.

2. **TOP SẢN PHẨM TRENDING**: Liệt kê 5-10 sản phẩm nước hoa đang được quan tâm nhiều nhất dựa trên dữ liệu tìm kiếm, xem, mua, và tương tác. Với mỗi sản phẩm:
   - Tên sản phẩm và thương hiệu
   - Lý do trending (được tìm kiếm nhiều / mua nhiều / đánh giá cao)
   - Mức độ phổ biến (cao / trung bình / đang tăng)

3. **PHÂN TÍCH THEO NHÓM HƯƠNG**: Xác định nhóm mùi hương (floral, woody, citrus, oriental...) nào đang được ưa chuộng nhất và xu hướng chuyển đổi.

4. **PHÂN KHÚC NGƯỜI DÙNG**: Nhóm người dùng nào (giới tính, độ tuổi, phong cách) đang tìm kiếm loại nước hoa nào.

5. **XU HƯỚNG THEO MÙA/THỜI TIẾT**: Liên hệ xu hướng hiện tại với mùa vụ và thời tiết để đưa ra dự đoán.

6. **ĐỀ XUẤT CHIẾN LƯỢC**:
   - Sản phẩm nên đẩy mạnh marketing
   - Sản phẩm nên nhập thêm hàng
   - Cơ hội cross-sell / up-sell
   - Dự đoán xu hướng 1-3 tháng tới

⚠️ QUAN TRỌNG:
- KHÔNG hỏi câu hỏi ngược lại người dùng.
- KHÔNG đưa ra các lựa chọn hoặc menu cho người dùng chọn.
- Hãy TRỰC TIẾP phân tích và đưa ra kết quả báo cáo.
- Trả lời dứt khoát, chuyên nghiệp như một báo cáo phân tích thị trường thực sự.
- Sử dụng dữ liệu cụ thể từ log để minh chứng cho các nhận định.
- Phải đề cập đến sản phẩm CỤ THỂ, KHÔNG nói chung chung.`;

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