import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecommendationVariantResponse {
  @ApiProperty() id: string;
  @ApiProperty() sku: string;
  @ApiProperty() volumeMl: number;
  @ApiProperty() basePrice: number;
}

export class RecommendationProductResponse {
  @ApiProperty() productId: string;
  @ApiProperty() productName: string;
  @ApiPropertyOptional({ nullable: true }) brand: string | null;
  @ApiPropertyOptional({ nullable: true }) primaryImage: string | null;
  @ApiProperty() variants: RecommendationVariantResponse[];
  @ApiProperty() source: string;
  @ApiPropertyOptional() aiAcceptanceId?: string;

  static fromPrismaProduct(p: unknown, source: string): RecommendationProductResponse | null {
    if (!p) return null;
    const raw = p as Record<string, unknown>;
    const dto = new RecommendationProductResponse();
    dto.productId = String(raw.Id ?? raw.id ?? '');
    dto.productName = String(raw.Name ?? raw.name ?? '');
    const brands = raw.Brands as Record<string, unknown> | undefined;
    dto.brand = (brands?.Name as string) ?? (raw.brandName as string) ?? null;
    const media = raw.Media as Array<Record<string, unknown>> | undefined;
    dto.primaryImage = media?.[0]?.Url as string ?? (raw.primaryImage as string) ?? null;
    const variants = (raw.ProductVariants as unknown[] | undefined) ?? (raw.variants as unknown[] | undefined) ?? [];
    dto.variants = variants.slice(0, 3).map((v: unknown) => {
      const rv = v as Record<string, unknown>;
      return {
        id: String(rv.Id ?? rv.id ?? ''),
        sku: String(rv.Sku ?? rv.sku ?? 'N/A'),
        volumeMl: Number(rv.VolumeMl ?? rv.volumeMl ?? 0),
        basePrice: Number(rv.BasePrice ?? rv.basePrice ?? 0)
      };
    });
    dto.source = source;
    dto.aiAcceptanceId = undefined;
    return dto;
  }

  static fromBestSellerProduct(p: unknown, source: string): RecommendationProductResponse | null {
    if (!p) return null;
    const raw = p as Record<string, unknown>;
    const dto = new RecommendationProductResponse();
    dto.productId = String(raw.id ?? '');
    dto.productName = String(raw.name ?? '');
    dto.brand = (raw.brandName as string) ?? null;
    dto.primaryImage = (raw.primaryImage as string) ?? null;
    const variants = (raw.variants as unknown[] | undefined) ?? [];
    dto.variants = variants.slice(0, 3).map((v: unknown) => {
      const rv = v as Record<string, unknown>;
      return {
        id: String(rv.id ?? ''),
        sku: String(rv.sku ?? 'N/A'),
        volumeMl: Number(rv.volumeMl ?? 0),
        basePrice: Number(rv.basePrice ?? 0)
      };
    });
    dto.source = source;
    dto.aiAcceptanceId = undefined;
    return dto;
  }
}

export class RecommendationProfileResponse {
  @ApiProperty() source: string;
  @ApiProperty() userType: string;
  @ApiProperty() topBrands: string[];
  @ApiPropertyOptional() topOrderProducts?: string[];
  @ApiPropertyOptional() profileKeywords?: string[];
  @ApiPropertyOptional() scentKeywords?: string[];
  @ApiPropertyOptional() olfactoryKeywords?: string[];
  @ApiPropertyOptional() genders?: string[];
  @ApiProperty() budgetRange: [number, number];
  @ApiPropertyOptional() avgPrice?: number;
  @ApiPropertyOptional() purchasedProductIds?: string[];
}

export class RecommendationResultResponse {
  @ApiProperty() userId: string;
  @ApiProperty() recommendations: RecommendationProductResponse[];
  @ApiProperty() totalProducts: number;
  @ApiProperty() profile: RecommendationProfileResponse;
  @ApiPropertyOptional() aiAcceptanceId?: string;
}

export class DailyRecommendationBatchSummaryResponse {
  @ApiProperty() triggeredBy: string;
  @ApiProperty() startedAt: string;
  @ApiProperty() finishedAt: string;
  @ApiProperty() durationMs: number;
  @ApiProperty() totalRecipients: number;
  @ApiProperty() sentCount: number;
  @ApiProperty() skippedNoRecommendation: number;
  @ApiProperty() skippedInvalidRecipient: number;
  @ApiProperty() failedCount: number;
}
