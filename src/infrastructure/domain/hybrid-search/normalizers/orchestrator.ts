import { Injectable } from '@nestjs/common';
import { PriceNormalizer, PriceNormalizerOutput } from './price.normalizer';
import { GenderNormalizer, GenderNormalizerOutput } from './gender.normalizer';
import { YearNormalizer, YearNormalizerOutput } from './year.normalizer';
import { OriginNormalizer, OriginNormalizerOutput } from './origin.normalizer';

import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Combined normalized query filters
 */
export class NormalizedQueryFilters {
  @ApiPropertyOptional({ type: () => PriceNormalizerOutput })
  price?: PriceNormalizerOutput;

  @ApiPropertyOptional({ type: () => GenderNormalizerOutput })
  gender?: GenderNormalizerOutput;

  @ApiPropertyOptional({ type: () => YearNormalizerOutput })
  year?: YearNormalizerOutput;

  @ApiPropertyOptional({ type: () => OriginNormalizerOutput })
  origin?: OriginNormalizerOutput;
}

/**
 * QueryNormalizerOrchestrator - Chạy tất cả normalizers và merge kết quả
 * Nếu normalizer nào trả về null thì không được merge
 */
@Injectable()
export class QueryNormalizerOrchestrator {
  constructor(
    private readonly priceNormalizer: PriceNormalizer,
    private readonly genderNormalizer: GenderNormalizer,
    private readonly yearNormalizer: YearNormalizer,
    private readonly originNormalizer: OriginNormalizer
  ) {}

  async normalize(searchText: string): Promise<NormalizedQueryFilters | null> {
    const [price, gender, year, origin] = await Promise.all([
      this.priceNormalizer.normalize(searchText),
      this.genderNormalizer.normalize(searchText),
      this.yearNormalizer.normalize(searchText),
      this.originNormalizer.normalize(searchText),
    ]);

    const filters: NormalizedQueryFilters = {};

    if (price) filters.price = price;
    if (gender) filters.gender = gender;
    if (year) filters.year = year;
    if (origin) filters.origin = origin;

    if (Object.keys(filters).length === 0) {
      return null;
    }

    return filters;
  }
}