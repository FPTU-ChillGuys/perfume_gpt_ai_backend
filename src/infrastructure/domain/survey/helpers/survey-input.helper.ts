import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { resolveLogUserIdFromRequest } from 'src/infrastructure/domain/utils/extract-token';

/**
 * Helper xử lý việc chuẩn hóa input cho Survey.
 * - Trích xuất userId từ request (token hoặc fingerprint)
 */
@Injectable()
export class SurveyInputHelper {
  /**
   * Resolve userId: ưu tiên query param, fallback từ JWT token hoặc fingerprint.
   */
  resolveUserId(request: Request, userId?: string): string {
    return userId || resolveLogUserIdFromRequest(request);
  }
}
