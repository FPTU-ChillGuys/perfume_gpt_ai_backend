/**
 * Improver prompt constant
 * Technical infrastructure prompt for the AI self-improvement pipeline.
 *
 * This prompt instructs the improver AI to analyze conversation quality
 * and propose upgrades to AdminInstruction (conversation + conversation_analysis).
 * Classified as "technical infrastructure" per AGENTS.md §4 — allowed as file constant.
 */

export const IMPROVER_SYSTEM_PROMPT =
  'Bạn là một AI Expert phân tích và cải tiến prompt. Trả về JSON hợp lệ.';

export const buildImproverPrompt = (
  conversationText: string,
  currentInstruction: string,
  currentAnalysisPrompt: string,
  confidenceThreshold: number = 80
): string => `Bạn là một AI Expert chuyên phân tích và cải tiến hệ thống prompt cho chatbot tư vấn nước hoa.

## NHIỆM VỤ
Phân tích cuộc trò chuyện bên dưới giữa AI và người dùng, đánh giá chất lượng phản hồi của AI, và đề xuất cải tiến instruction nếu cần.

## CUỘC TRÒ CHUYỆN CẦN PHÂN TÍCH
\`\`\`
${conversationText}
\`\`\`

## INSTRUCTION HIỆN TẠI CỦA AI (CONVERSATION)
\`\`\`
${currentInstruction || '(Chưa có instruction)'}
\`\`\`

## PROMPT PHÂN TÍCH KEYWORD HIỆN TẠI (CONVERSATION_ANALYSIS)
\`\`\`
${currentAnalysisPrompt || '(Chưa có prompt)'}
\`\`\`

## TIÊU CHÍ ĐÁNH GIÁ
1. AI có trả lời đúng trọng tâm câu hỏi của user không?
2. AI có follow đúng format yêu cầu trong instruction không (emoji, bullet points, --- separator)?
3. AI có gợi ý sản phẩm phù hợp không? Có bịa sản phẩm không?
4. AI có hỏi lại những thông tin user đã cung cấp không?
5. Instruction hiện tại có chỗ nào gây hiểu nhầm, mâu thuẫn, hoặc thiếu rõ ràng?
6. Prompt phân tích keyword có giúp AI chính hiểu đúng ý định user không?

## YÊU CẦU OUTPUT
- conversationConfidence (number 0-100): Độ tự tin về việc cần sửa CONVERSATION instruction. ≥ ${confidenceThreshold}% nếu instruction có vấn đề RÕ RÀNG cần sửa. < ${confidenceThreshold}% nếu instruction đã ổn.
- analysisConfidence (number 0-100): Độ tự tin về việc cần sửa CONVERSATION_ANALYSIS prompt. ≥ ${confidenceThreshold}% nếu prompt có vấn đề RÕ RÀNG cần sửa. < ${confidenceThreshold}% nếu prompt đã ổn.
- improvedInstruction (string): Instruction CONVERSATION đã được cải tiến. Viết LẠI TOÀN BỘ instruction. Giữ nguyên tiếng Việt. Nếu conversationConfidence < ${confidenceThreshold}%, trả về chuỗi rỗng "".
- improvedAnalysisPrompt (string): Prompt phân tích keyword đã được cải tiến. Viết LẠI TOÀN BỘ. Nếu analysisConfidence < ${confidenceThreshold}%, trả về chuỗi rỗng "".
- reason (string): Lý do ngắn gọn cho từng quyết định (ví dụ: "Conversation: giữ nguyên vì đã rõ. Analysis: cần sửa vì không phân biệt Recommend vs Consult").

## LƯU Ý QUAN TRỌNG
- HAI CONFIDENCE ĐỘC LẬP: Có thể cho conversationConfidence cao nhưng analysisConfidence thấp, hoặc ngược lại.
- CHỈ cho confidence cao (≥ ${confidenceThreshold}%) khi thực sự phát hiện vấn đề rõ ràng. Đừng cho cao chỉ vì "có thể tốt hơn một chút".
- Khi viết improvedInstruction/improvedAnalysisPrompt, giữ nguyên tinh thần và mục tiêu của bản gốc, chỉ sửa những chỗ gây hiểu nhầm hoặc thiếu sót.
- Nếu bản gốc đã tốt, cho confidence < ${confidenceThreshold}% và giải thích lý do.`;