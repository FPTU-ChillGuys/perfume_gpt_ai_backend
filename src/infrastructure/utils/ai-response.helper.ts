import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { AIAnalysisResponse, AIResponseMetadata } from 'src/application/dtos/response/ai-structured.response';

/**
 * Gọi hàm AI và bọc kết quả vào AIAnalysisResponse có cấu trúc, kèm metadata thời gian xử lý.
 *
 * @param aiFn - Hàm async gọi AI service, trả về BaseResponse<string>
 * @returns BaseResponse<AIAnalysisResponse> với thời gian xử lý và nội dung AI
 *
 * @example
 * ```ts
 * const result = await wrapAIResponseWithMetadata(
 *   () => this.aiService.textGenerateFromPrompt(prompt)
 * );
 * // result.data.content = "AI Text..."
 * // result.data.metadata.processingTimeMs = 1234
 * ```
 */
export async function wrapAIResponseWithMetadata(
  aiFn: () => Promise<BaseResponse<string>>
): Promise<BaseResponse<AIAnalysisResponse>> {
  const startTime = Date.now();
  const aiResult = await aiFn();
  const processingTimeMs = Date.now() - startTime;

  if (!aiResult.success) {
    return { success: false, error: aiResult.error };
  }

  const metadata = new AIResponseMetadata({
    processingTimeMs,
    inputTokenEstimate: Math.ceil((aiResult.data?.length ?? 0) / 4)
  });

  const response = new AIAnalysisResponse({
    content: aiResult.data ?? '',
    generatedAt: new Date(),
    metadata
  });

  return { success: true, data: response };
}

/**
 * Đo thời gian thực thi của một hàm async bất kỳ.
 *
 * @param fn - Hàm async cần đo thời gian
 * @returns Object chứa kết quả + thời gian xử lý (ms)
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; processingTimeMs: number }> {
  const startTime = Date.now();
  const result = await fn();
  const processingTimeMs = Date.now() - startTime;
  return { result, processingTimeMs };
}
