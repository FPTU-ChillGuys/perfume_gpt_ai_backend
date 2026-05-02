import { ApiProperty } from '@nestjs/swagger';
import { PagedAndSortedRequest } from './paged-and-sorted.request';

export class BatchRequest extends PagedAndSortedRequest {
  @ApiProperty({ required: false, description: 'Batch ID' })
  id?: string;

  @ApiProperty({ required: false, description: 'Variant ID' })
  variantId?: string;

  @ApiProperty({ required: false, description: 'Variant SKU' })
  variantSku?: string;

  @ApiProperty({ required: false, description: 'Product name' })
  productName?: string;

  @ApiProperty({ required: false, description: 'Volume in milliliters' })
  volumeMl?: number;

  @ApiProperty({ required: false, description: 'Concentration name' })
  concentrationName?: string;

  @ApiProperty({ required: false, description: 'Batch code' })
  batchCode?: string;

  @ApiProperty({
    required: false,
    description: 'Manufacture date',
    example: '2024-01-01'
  })
  manufactureDate?: string;

  @ApiProperty({
    required: false,
    description: 'Expiry date',
    example: '2025-01-01'
  })
  expiryDate?: string;

  @ApiProperty({ required: false, description: 'Import quantity' })
  importQuantity?: number;

  @ApiProperty({ required: false, description: 'Remaining quantity' })
  remainingQuantity?: number;

  @ApiProperty({ required: false, description: 'Whether the batch is expired' })
  isExpired?: boolean;

  @ApiProperty({ required: false, description: 'Number of days until expiry' })
  daysUntilExpiry?: number;

  @ApiProperty({
    required: false,
    description: 'Created at timestamp',
    example: '2024-01-01T00:00:00Z'
  })
  createdAt?: string;

  constructor(init?: Partial<BatchRequest>) {
    super();
    Object.assign(this, init);
  }
}
