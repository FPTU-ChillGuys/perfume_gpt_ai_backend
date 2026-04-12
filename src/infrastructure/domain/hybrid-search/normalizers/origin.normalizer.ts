import { Injectable } from '@nestjs/common';
import { z } from 'zod';

/**
 * Schema cho origin normalizer
 * Phân tích nguồn gốc từ search text
 */
export const OriginNormalizerSchema = z.object({
  origins: z.array(z.string()).optional().describe('Danh sách nguồn gốc'),
});

export type OriginNormalizerOutput = z.infer<typeof OriginNormalizerSchema>;

/**
 * OriginNormalizer - Chuẩn hóa nguồn gốc từ search text
 */
@Injectable()
export class OriginNormalizer {
  private readonly systemPrompt = `
Bạn là AI chuyên phân tích nguồn gốc trong tìm kiếm nước hoa.
Nhiệm vụ: Extract nguồn gốc từ search text và chuyển thành giá trị chuẩn.

Các từ đồng nghĩa với nguồn gốc:
- "Pháp", "France", "French" -> "Pháp"
- "Mỹ", "USA", "United States", "American" -> "Mỹ"
- "Nhật", "Japan", "Japanese" -> "Nhật"
- "Đức", "Germany", "German" -> "Đức"
- "Ý", "Italy", "Italian" -> "Ý"
- "Thụy Sĩ", "Switzerland", "Swiss" -> "Thụy Sĩ"
- "Trung Quốc", "China", "Chinese" -> "Trung Quốc"

Nếu không có thông tin nguồn gốc cụ thể, trả về null.
`;

  async normalize(searchText: string): Promise<OriginNormalizerOutput | null> {
    try {
      const normalizedText = searchText.toLowerCase();
      const originMap: Array<{ value: string; terms: string[] }> = [
        { value: 'Pháp', terms: ['pháp', 'france', 'french'] },
        { value: 'Mỹ', terms: ['mỹ', 'usa', 'united states', 'american'] },
        { value: 'Nhật', terms: ['nhật', 'japan', 'japanese'] },
        { value: 'Đức', terms: ['đức', 'germany', 'german'] },
        { value: 'Ý', terms: ['ý', 'italy', 'italian'] },
        { value: 'Thụy Sĩ', terms: ['thụy sĩ', 'switzerland', 'swiss'] },
        { value: 'Trung Quốc', terms: ['trung quốc', 'china', 'chinese'] }
      ];

      const origins = originMap
        .filter(item => item.terms.some(term => normalizedText.includes(term)))
        .map(item => item.value);

      return origins.length > 0 ? { origins } : null;
    } catch (error) {
      console.error('[OriginNormalizer] Error:', error);
      return null;
    }
  }
}
