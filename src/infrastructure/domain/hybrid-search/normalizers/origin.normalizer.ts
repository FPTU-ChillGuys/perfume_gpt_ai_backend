import { Injectable, Logger } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Schema cho origin normalizer
 * Phân tích nguồn gốc từ search text
 */
export const OriginNormalizerSchema = z.object({
  origins: z.array(z.string()).optional().describe('Danh sách nguồn gốc'),
});

export class OriginNormalizerOutput {
  @ApiPropertyOptional({ description: 'Danh sách nguồn gốc', type: [String] })
  origins?: string[];
}

/**
 * OriginNormalizer - Chuẩn hóa nguồn gốc từ search text
 */
@Injectable()
export class OriginNormalizer {
  private readonly logger = new Logger(OriginNormalizer.name);

  private readonly originMap: Array<{ value: string; terms: string[] }> = [
    { value: 'Pháp', terms: ['pháp', 'france', 'french'] },
    { value: 'Mỹ', terms: ['mỹ', 'usa', 'united states', 'american'] },
    { value: 'Nhật', terms: ['nhật', 'japan', 'japanese'] },
    { value: 'Đức', terms: ['đức', 'germany', 'german'] },
    { value: 'Ý', terms: ['ý', 'italy', 'italian'] },
    { value: 'Thụy Sĩ', terms: ['thụy sĩ', 'switzerland', 'swiss'] },
    { value: 'Trung Quốc', terms: ['trung quốc', 'china', 'chinese'] }
  ];

  async normalize(searchText: string): Promise<OriginNormalizerOutput | null> {
    try {
      const normalizedText = searchText.toLowerCase();
      const origins = this.originMap
        .filter(item => item.terms.some(term => normalizedText.includes(term)))
        .map(item => item.value);

      return origins.length > 0 ? { origins } : null;
    } catch (error) {
      this.logger.error('Error normalizing origin', error);
      return null;
    }
  }
}