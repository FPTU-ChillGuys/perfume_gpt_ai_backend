/**
 * Service-level prompt functions
 * Các prompt được sử dụng trong service layer
 */

// ==================== User Log Summary Prompts ====================

/**
 * Prompt tổng hợp hoạt động người dùng theo khoảng thời gian
 */
export const generateSummaryPrompt = (
  searchContents: string,
  messageContents: string,
  surveyContents: string,
  startDate: Date,
  endDate: Date
): string => {
  let prompt = `Tóm tắt các hoạt động của người dùng từ ngày ${startDate.toDateString()} đến ngày ${new Date(endDate).toDateString()}.\n`;
  if (searchContents) {
    prompt += `Hoạt động tìm kiếm: ${searchContents}\n`;
  }
  if (messageContents) {
    prompt += `Tin nhắn: ${messageContents}\n`;
  }
  if (surveyContents) {
    prompt += `Câu trả lời survey: ${surveyContents}\n`;
  }
  prompt += `Hãy cung cấp một bản tóm tắt ngắn gọn về các hoạt động của người dùng trong giai đoạn này.`;
  return prompt;
};

// ==================== Survey Prompts ====================

/**
 * Chuyển đổi danh sách câu hỏi-trả lời thành chuỗi
 */
export const convertQuesAnsesToString = (
  quesAnses: Array<{ question: string; answer: string }>
): string => {
  return quesAnses
    .map(
      (qa, index) =>
        `Câu ${index + 1}. Câu hỏi: ${qa.question}\n  Nội dung câu trả lời của khách hàng: ${qa.answer}\n`
    )
    .join('\n');
};

/**
 * Prompt phân tích kết quả survey và đề xuất nước hoa
 *
 * QUYẾT ĐỊNH PHÂN 2 BƯỚC:
 * 1. PHÂN TÍCH: Xác định sở thích từ survey data (KHÔNG GỌI TOOL)
 * 2. GỌI TOOL: Dựa trên kết quả phân tích, gọi tool tìm sản phẩm thực tế
 *
 * YÊU CẦU OUTPUT có cấu trúc JSON gồm 2 field:
 *   - message: lời tư vấn thân thiện (string) giải thích tại sao phù hợp
 *   - products: mảng sản phẩm thực tế lấy từ kết quả tool (array)
 */
export const surveyPrompt = (
  quesAnses: Array<{ question: string; answer: string }>
): string => `
Đây là kết quả survey tư vấn nước hoa của một khách hàng, bao gồm các câu hỏi và câu trả lời của họ để hiểu sở thích và nhu cầu của khách hàng (Và vui lòng gọi các tool đã được cung cấp để lấy dữ liệu sản phẩm thực tế, đừng dựa vào trí nhớ hoặc phỏng đoán):
${convertQuesAnsesToString(quesAnses)}
`;


