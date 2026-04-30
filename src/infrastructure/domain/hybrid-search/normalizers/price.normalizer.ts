import { Injectable, Logger } from '@nestjs/common';
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
 * Hệ thống vector không thể lọc giá, nên dùng regex để extract và query layer sẽ filter
 */
@Injectable()
export class PriceNormalizer {
  private readonly logger = new Logger(PriceNormalizer.name);

  private readonly priceRegex = /(\d+(?:[\.,]\d+)?)\s*(triệu|tr|m)/i;
  private readonly rangeRegex = /(\d+(?:[\.,]\d+)?)\s*(?:-|đến|tới|to)\s*(\d+(?:[\.,]\d+)?)\s*(triệu|tr|m)/i;
  private readonly lessThanPattern = /dưới|<=|less than|under|tối đa|không quá/i;
  private readonly greaterThanPattern = /trên|>=|more than|over|ít nhất|từ/i;

  async normalize(searchText: string): Promise<PriceNormalizerOutput | null> {
    try {
      const normalizedText = searchText.toLowerCase();
      const priceMatch = normalizedText.match(this.priceRegex);

      if (!priceMatch) {
        return null;
      }

      const rawValue = Number(priceMatch[1].replace(',', '.'));
      const valueInVnd = rawValue < 1000 ? rawValue * 1_000_000 : rawValue;

      if (this.lessThanPattern.test(normalizedText)) {
        return { max: valueInVnd, operator: 'lte' };
      }

      if (this.greaterThanPattern.test(normalizedText)) {
        return { min: valueInVnd, operator: 'gte' };
      }

      const rangeMatch = normalizedText.match(this.rangeRegex);
      if (rangeMatch) {
        const minValue = Number(rangeMatch[1].replace(',', '.')) * 1_000_000;
        const maxValue = Number(rangeMatch[2].replace(',', '.')) * 1_000_000;
        return { min: minValue, max: maxValue, operator: 'between' };
      }

      return { max: valueInVnd, operator: 'lte' };
    } catch (error) {
      this.logger.error('Error normalizing price', error);
      return null;
    }
  }
}