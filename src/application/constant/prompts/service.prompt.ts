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
  quizContents: string,
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
  if (quizContents) {
    prompt += `Câu trả lời quiz: ${quizContents}\n`;
  }
  prompt += `Hãy cung cấp một bản tóm tắt ngắn gọn về các hoạt động của người dùng trong giai đoạn này.`;
  return prompt;
};

// ==================== Quiz Prompts ====================

/**
 * Chuyển đổi danh sách câu hỏi-trả lời thành chuỗi
 */
export const convertQuesAnsesToString = (
  quesAnses: Array<{ question: string; answer: string }>
): string => {
  return quesAnses
    .map(
      (qa, index) =>
        `${index + 1}. Câu hỏi: ${qa.question}\n   Trả lời: ${qa.answer}`
    )
    .join('\n');
};

/**
 * Prompt phân tích kết quả quiz và đề xuất nước hoa
 */
export const quizPrompt = (
  quesAnses: Array<{ question: string; answer: string }>
): string => `
Bạn là một chuyên gia về nước hoa. Dựa trên các câu hỏi và câu trả lời dưới đây, hãy phân tích và đưa ra nhận định về sở thích nước hoa của người dùng:
${convertQuesAnsesToString(quesAnses)}
Dựa vào các thông tin trên:
- Phân tích phong cách mùi hương phù hợp
- Đề xuất 1-3 loại nước hoa phù hợp nhất
- Với mỗi loại, giải thích ngắn gọn vì sao phù hợp
- Nếu có, gợi ý nồng độ (EDT / EDP / Parfum)
- Viết bằng tiếng Việt hoặc tiếng anh, giọng tư vấn thân thiện, dễ hiểu

Lưu ý, hãy sử dụng tool getAllProducts để tham khảo danh sách nước hoa hiện có trước khi đề xuất.`;
