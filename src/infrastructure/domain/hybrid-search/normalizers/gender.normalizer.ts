import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Schema cho gender normalizer
 * Phân tích giới tính từ search text
 */
export const GenderNormalizerSchema = z.object({
  value: z.enum(['Nam', 'Nữ', 'Unisex']).optional().describe('Giới tính nước hoa'),
});

export type GenderNormalizerOutput = z.infer<typeof GenderNormalizerSchema>;

/**
 * GenderNormalizer - Chuẩn hóa giới tính từ search text
 * Có context từ DB để đảm bảo keyword chuẩn
 */
@Injectable()
export class GenderNormalizer {
  private readonly systemPrompt = `
Bạn là AI chuyên phân tích giới tính trong tìm kiếm nước hoa.
Nhiệm vụ: Extract giới tính từ search text và chuyển thành giá trị chuẩn.

Các từ đồng nghĩa với giới tính:
- "nam", "nam tính", "cho nam", "nam giới" -> "Nam"
- "nữ", "nữ tính", "cho nữ", "nữ giới", "lady", "women" -> "Nữ"
- "unisex", "cả nam và nữ", "cho mọi người", "genderless" -> "Unisex"

Chỉ trả về giá trị chuẩn nếu xác định được giới tính.
Nếu không có thông tin giới tính, trả về null.
`;

  constructor(private prisma: PrismaService) {}

  async normalize(searchText: string): Promise<GenderNormalizerOutput | null> {
    try {
      const normalizedText = searchText.toLowerCase();
      const genderTerms = [
        { value: 'Nam' as const, terms: ['nam', 'nam tính', 'cho nam', 'male', 'men'] },
        { value: 'Nữ' as const, terms: ['nữ', 'nữ tính', 'cho nữ', 'female', 'women', 'lady'] },
        { value: 'Unisex' as const, terms: ['unisex', 'cả nam và nữ', 'cho mọi người', 'genderless'] }
      ];

      for (const item of genderTerms) {
        if (item.terms.some(term => normalizedText.includes(term))) {
          return { value: item.value };
        }
      }

      return null;
    } catch (error) {
      console.error('[GenderNormalizer] Error:', error);
      return null;
    }
  }
}
