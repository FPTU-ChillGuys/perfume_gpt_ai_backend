import { Injectable } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Schema cho price normalizer
 * Phân tích giá cả từ search text
 */
export const PriceNormalizerSchema = z.object({
  min: z.number().optional().describe('Giá tối thiểu (VND)'),
  max: z.number().optional().describe('Giá tối đa (VND)'),
  operator: z.enum(['lt', 'lte', 'gt', 'gte', 'between']).optional().describe('Toán tử so sánh'),
});

export class PriceNormalizerOutput {
  @ApiPropertyOptional({ description: 'Giá tối thiểu (VND)' })
  min?: number;

  @ApiPropertyOptional({ description: 'Giá tối đa (VND)' })
  max?: number;

  @ApiPropertyOptional({ 
    description: 'Toán tử so sánh', 
    enum: ['lt', 'lte', 'gt', 'gte', 'between'] 
  })
  operator?: 'lt' | 'lte' | 'gt' | 'gte' | 'between';
}


/**
 * PriceNormalizer - Chuẩn hóa thông tin giá cả từ search text
 * Hệ thống vector không thể lọc giá, nên dùng AI để extract và query layer sẽ filter
 */
@Injectable()
export class PriceNormalizer {
  private readonly systemPrompt = `
Bạn là AI chuyên phân tích giá cả trong tìm kiếm nước hoa.
Nhiệm vụ: Extract thông tin giá từ search text và chuyển thành cấu trúc chuẩn.

Các pattern giá thường gặp:
- "dưới X triệu" -> { max: X*1000000, operator: "lte" }
- "trên X triệu" -> { min: X*1000000, operator: "gte" }
- "X đến Y triệu" -> { min: X*1000000, max: Y*1000000, operator: "between" }
- "khoảng X triệu" -> { min: X*1000000 - 100000, max: X*1000000 + 100000, operator: "between" }
- "giá rẻ", "rẻ", "tầm trung", "cao cấp" -> null (không extract được giá cụ thể)

Nếu không có thông tin giá cụ thể, trả về null.
`;

  async normalize(searchText: string): Promise<PriceNormalizerOutput | null> {
    try {
      const normalizedText = searchText.toLowerCase();
      const priceMatch = normalizedText.match(/(\d+(?:[\.,]\d+)?)\s*(triệu|tr|m)/i);

      if (!priceMatch) {
        return null;
      }

      const rawValue = Number(priceMatch[1].replace(',', '.'));
      const valueInVnd = rawValue < 1000 ? rawValue * 1_000_000 : rawValue;

      if (/dưới|<=|less than|under|tối đa|không quá/i.test(normalizedText)) {
        return { max: valueInVnd, operator: 'lte' };
      }

      if (/trên|>=|more than|over|ít nhất|từ/i.test(normalizedText)) {
        return { min: valueInVnd, operator: 'gte' };
      }

      const rangeMatch = normalizedText.match(/(\d+(?:[\.,]\d+)?)\s*(?:-|đến|tới|to)\s*(\d+(?:[\.,]\d+)?)\s*(triệu|tr|m)/i);
      if (rangeMatch) {
        const minValue = Number(rangeMatch[1].replace(',', '.')) * 1_000_000;
        const maxValue = Number(rangeMatch[2].replace(',', '.')) * 1_000_000;
        return { min: minValue, max: maxValue, operator: 'between' };
      }

      return { max: valueInVnd, operator: 'lte' };
    } catch (error) {
      console.error('[PriceNormalizer] Error:', error);
      return null;
    }
  }
}
