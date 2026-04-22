import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';

/**
 * Kết quả xây dựng combined prompt từ user log + order report.
 */
export interface CombinedPromptResult {
  combinedPrompt: string;
  adminInstruction: string;
}

/**
 * Xây dựng combined prompt cho V5.
 *
 * @param typeOfInstruction - Loại instruction domain để lấy admin instruction tương ứng
 * @param adminInstructionService - AdminInstructionService instance
 * @param userId - ID người dùng
 * @returns Combined prompt + dữ liệu thành phần
 */
export async function buildCombinedPromptV5(
  typeOfInstruction: string,
  adminInstructionService: AdminInstructionService,
  userId: string | undefined,
): Promise<BaseResponse<CombinedPromptResult>> {
  // Lấy admin instruction cho conversation (nếu có)
  const adminInstruction =
    await adminInstructionService.getSystemPromptForDomain(typeOfInstruction);

  const combinedPrompt = `
    ${adminInstruction ? `\n\n
      Hướng dẫn quản trị viên:\n${adminInstruction}` : ''
    }
    ${userId ? `\n\n[ID người dùng: ${userId}]` : '\n\n[Khách vãng lai - không có ID]'}`;

  return {
    success: true,
    data: {
      combinedPrompt,
      adminInstruction
    }
  };

}

