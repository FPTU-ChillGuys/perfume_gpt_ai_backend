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
 *
 * YÊU CẦU OUTPUT có cấu trúc JSON gồm 2 field:
 *   - message: lời tư vấn thân thiện (string)
 *   - products: mảng sản phẩm thực tế lấy từ kết quả tool (array)
 */
export const quizPrompt = (
  quesAnses: Array<{ question: string; answer: string }>
): string => `
Bạn là một chuyên gia tư vấn nước hoa. Dựa trên các câu hỏi và câu trả lời quiz sau, hãy phân tích sở thích của người dùng và đề xuất 1–3 sản phẩm nước hoa phù hợp nhất:

${convertQuesAnsesToString(quesAnses)}

## QUY TRÌNH BẮT BUỘC
1. Gọi tool searchProduct hoặc getAllProducts để tìm kiếm sản phẩm thực tế từ cơ sở dữ liệu dựa trên sở thích quiz.
2. Từ kết quả tool, chọn 1–3 sản phẩm phù hợp nhất.
3. Trả về JSON với đúng 2 field:
   - "message": lời tư vấn ngắn gọn bằng tiếng Việt, thân thiện, giải thích tại sao mỗi sản phẩm phù hợp với câu trả lời quiz, nồng độ gợi ý (EDT/EDP/Parfum). KHÔNG liệt kê sản phẩm trong message — sản phẩm được trả trong field products.
   - "products": mảng các sản phẩm THỰC TẾ lấy từ kết quả tool, mỗi phần tử phải có đủ các field: id, name, description, brandName, categoryName, primaryImage, attributes.

## LƯU Ý QUAN TRỌNG
- Trường "products" PHẢI chứa dữ liệu thực từ kết quả tool call, KHÔNG được để mảng rỗng nếu tool đã trả về sản phẩm.
- Nếu tool không tìm thấy sản phẩm phù hợp, products để [], và ghi rõ trong message.
- id phải được lấy chính xác từ kết quả tool (UUID thực), không tự tạo.`;
