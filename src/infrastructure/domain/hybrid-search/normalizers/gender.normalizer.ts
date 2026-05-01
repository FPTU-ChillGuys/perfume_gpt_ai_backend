import { Injectable, Logger } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Schema cho gender normalizer
 * Phân tích giới tính từ search text
 */
export const GenderNormalizerSchema = z.object({
  value: z
    .enum(['Nam', 'Nữ', 'Unisex'])
    .optional()
    .describe('Giới tính nước hoa')
});

export class GenderNormalizerOutput {
  @ApiPropertyOptional({
    description: 'Giới tính nước hoa',
    enum: ['Nam', 'Nữ', 'Unisex']
  })
  value?: 'Nam' | 'Nữ' | 'Unisex';
}

/**
 * GenderNormalizer - Chuẩn hóa giới tính từ search text
 */
@Injectable()
export class GenderNormalizer {
  private readonly logger = new Logger(GenderNormalizer.name);

  private readonly genderTerms = [
    {
      value: 'Nam' as const,
      terms: ['nam', 'nam tính', 'cho nam', 'male', 'men']
    },
    {
      value: 'Nữ' as const,
      terms: ['nữ', 'nữ tính', 'cho nữ', 'female', 'women', 'lady']
    },
    {
      value: 'Unisex' as const,
      terms: ['unisex', 'cả nam và nữ', 'cho mọi người', 'genderless']
    }
  ];

  async normalize(searchText: string): Promise<GenderNormalizerOutput | null> {
    try {
      const normalizedText = searchText.toLowerCase();

      for (const item of this.genderTerms) {
        if (item.terms.some((term) => normalizedText.includes(term))) {
          return { value: item.value };
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Error normalizing gender', error);
      return null;
    }
  }
}
