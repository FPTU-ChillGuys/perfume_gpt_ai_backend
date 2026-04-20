import { Injectable } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Schema cho year normalizer
 * Phân tích năm ra mắt từ search text
 */
export const YearNormalizerSchema = z.object({
  year: z.number().int().optional().describe('Năm ra mắt'),
  operator: z.enum(['eq', 'gte', 'lte', 'newer', 'older']).optional().describe('Toán tử so sánh'),
});

export class YearNormalizerOutput {
  @ApiPropertyOptional({ description: 'Năm ra mắt' })
  year?: number;

  @ApiPropertyOptional({ 
    description: 'Toán tử so sánh', 
    enum: ['eq', 'gte', 'lte', 'newer', 'older'] 
  })
  operator?: 'eq' | 'gte' | 'lte' | 'newer' | 'older';
}


/**
 * YearNormalizer - Chuẩn hóa năm ra mắt từ search text
 */
@Injectable()
export class YearNormalizer {
  private readonly systemPrompt = `
Bạn là AI chuyên phân tích năm ra mắt trong tìm kiếm nước hoa.
Nhiệm vụ: Extract năm từ search text và chuyển thành cấu trúc chuẩn.

Các pattern năm thường gặp:
- "năm X" -> { year: X, operator: "eq" }
- "từ năm X" -> { year: X, operator: "gte" }
- "trước năm X" -> { year: X, operator: "lte" }
- "mới ra mắt", "new", "2024", "2025" -> { year: currentYear, operator: "gte" }
- "cổ điển", "vintage", "retro" -> { year: 2000, operator: "lte" }

Nếu không có thông tin năm cụ thể, trả về null.
`;

  async normalize(searchText: string): Promise<YearNormalizerOutput | null> {
    try {
      const normalizedText = searchText.toLowerCase();
      const yearMatch = normalizedText.match(/(19\d{2}|20\d{2})/);

      if (!yearMatch) {
        return null;
      }

      const year = Number(yearMatch[1]);
      if (/trước|older|cũ|vintage|retro/i.test(normalizedText)) {
        return { year, operator: 'lte' };
      }

      if (/sau|mới|new|recent|ra mắt|from/i.test(normalizedText)) {
        return { year, operator: 'gte' };
      }

      return { year, operator: 'eq' };
    } catch (error) {
      console.error('[YearNormalizer] Error:', error);
      return null;
    }
  }
}
