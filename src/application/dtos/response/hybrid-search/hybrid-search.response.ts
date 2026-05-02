import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { ProductWithVariantsResponse } from 'src/application/dtos/response/product-with-variants.response';
import { NormalizedQueryFilters } from 'src/infrastructure/domain/hybrid-search/normalizers/orchestrator';

export class HybridSearchResponse extends PagedResult<ProductWithVariantsResponse> {
  @ApiProperty({
    description: 'Danh sách bản ghi',
    type: () => [ProductWithVariantsResponse]
  })
  declare items: ProductWithVariantsResponse[];

  @ApiPropertyOptional({
    description: 'Filters found in query',
    type: () => NormalizedQueryFilters,
    nullable: true
  })
  queryFilters?: NormalizedQueryFilters | null;

  @ApiProperty({ description: 'Whether vector similarity was used' })
  vectorSimilarity?: boolean;
}
