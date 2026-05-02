import { Injectable, Logger } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Schema cho year normalizer
 * Phân tích năm ra mắt từ search text
 */
export const YearNormalizerSchema = z.object({
  year: z.number().int().optional().describe('Năm ra mắt'),
  operator: z
    .enum(['eq', 'gte', 'lte', 'newer', 'older'])
    .optional()
    .describe('Toán tử so sánh')
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
  private readonly logger = new Logger(YearNormalizer.name);

  private readonly yearRegex = /(19\d{2}|20\d{2})/;
  private readonly olderPattern = /trước|older|cũ|vintage|retro/i;
  private readonly newerPattern = /sau|mới|new|recent|ra mắt|from/i;

  async normalize(searchText: string): Promise<YearNormalizerOutput | null> {
    try {
      const normalizedText = searchText.toLowerCase();
      const yearMatch = normalizedText.match(this.yearRegex);

      if (!yearMatch) {
        return null;
      }

      const year = Number(yearMatch[1]);
      if (this.olderPattern.test(normalizedText)) {
        return { year, operator: 'lte' };
      }

      if (this.newerPattern.test(normalizedText)) {
        return { year, operator: 'gte' };
      }

      return { year, operator: 'eq' };
    } catch (error) {
      this.logger.error('Error normalizing year', error);
      return null;
    }
  }
}
