import { Injectable } from '@nestjs/common';
import { PriceNormalizer, PriceNormalizerOutput } from './price.normalizer';
import { GenderNormalizer, GenderNormalizerOutput } from './gender.normalizer';
import { YearNormalizer, YearNormalizerOutput } from './year.normalizer';
import { OriginNormalizer, OriginNormalizerOutput } from './origin.normalizer';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Combined normalized query filters
 */
export interface NormalizedQueryFilters {
  price?: PriceNormalizerOutput;
  gender?: GenderNormalizerOutput;
  year?: YearNormalizerOutput;
  origin?: OriginNormalizerOutput;
}

/**
 * QueryNormalizerOrchestrator - Chạy tất cả normalizers và merge kết quả
 * Nếu normalizer nào trả về null thì không được merge
 */
@Injectable()
export class QueryNormalizerOrchestrator {
  private priceNormalizer: PriceNormalizer;
  private genderNormalizer: GenderNormalizer;
  private yearNormalizer: YearNormalizer;
  private originNormalizer: OriginNormalizer;

  constructor(prisma: PrismaService) {
    this.priceNormalizer = new PriceNormalizer();
    this.genderNormalizer = new GenderNormalizer(prisma);
    this.yearNormalizer = new YearNormalizer();
    this.originNormalizer = new OriginNormalizer();
  }

  /**
   * Phân tích và chuẩn hóa tất cả filters từ search text
   * @param searchText - Text tìm kiếm
   * @returns NormalizedQueryFilters (chỉ merge các normalizer không trả về null)
   */
  async normalize(searchText: string): Promise<NormalizedQueryFilters | null> {
    // Chạy tất cả normalizers song song
    const [price, gender, year, origin] = await Promise.all([
      this.priceNormalizer.normalize(searchText),
      this.genderNormalizer.normalize(searchText),
      this.yearNormalizer.normalize(searchText),
      this.originNormalizer.normalize(searchText),
    ]);

    // Merge các kết quả không null
    const filters: NormalizedQueryFilters = {};
    
    if (price) filters.price = price;
    if (gender) filters.gender = gender;
    if (year) filters.year = year;
    if (origin) filters.origin = origin;

    // Nếu không có filter nào thì trả về null
    if (Object.keys(filters).length === 0) {
      return null;
    }

    return filters;
  }
}
