import { z } from 'zod';

/**
 * Improver output schema — Azure/Groq strict JSON schema compliance.
 * ALL properties MUST be in required array — NO .optional() / .default().
 * When no improvement needed, AI returns empty string "" instead of null/undefined.
 *
 * Separate confidence per instruction type allows independent upgrade decisions:
 * - conversationConfidence ≥ 80% → auto-apply CONVERSATION instruction
 * - analysisConfidence ≥ 80% → auto-apply CONVERSATION_ANALYSIS prompt
 */
export const improverOutputSchema = z.object({
  conversationConfidence: z
    .number()
    .min(0)
    .max(100)
    .describe('Độ tự tin về việc cần sửa CONVERSATION instruction (%). ≥ 80% → hệ thống tự áp dụng.'),
  analysisConfidence: z
    .number()
    .min(0)
    .max(100)
    .describe('Độ tự tin về việc cần sửa CONVERSATION_ANALYSIS prompt (%). ≥ 80% → hệ thống tự áp dụng.'),
  improvedInstruction: z
    .string()
    .describe('Instruction CONVERSATION đã được cải tiến. Nếu không cần cải tiến, trả về chuỗi rỗng ""'),
  improvedAnalysisPrompt: z
    .string()
    .describe('Prompt CONVERSATION_ANALYSIS đã được cải tiến. Nếu không cần cải tiến, trả về chuỗi rỗng ""'),
  reason: z.string().describe('Lý do cải tiến hoặc từ chối cho từng loại')
});

export type ImproverOutput = z.infer<typeof improverOutputSchema>;