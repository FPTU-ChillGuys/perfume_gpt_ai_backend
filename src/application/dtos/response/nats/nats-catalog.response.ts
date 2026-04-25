import { ApiProperty } from '@nestjs/swagger';

export class NatsCatalogItemResponse {
  @ApiProperty()
    id!: string;
  @ApiProperty()
    variantId!: string;
  @ApiProperty()
    supplierId!: number;
  @ApiProperty()
    supplierName!: string;
  @ApiProperty()
    basePrice!: number;
  @ApiProperty()
    minOrderQuantity!: number;
  @ApiProperty()
    leadTimeDays!: number;
  @ApiProperty()
    isPrimary!: boolean;
}

export class NatsCatalogResponse {
  @ApiProperty({ type: [NatsCatalogItemResponse] })
    catalogs!: NatsCatalogItemResponse[];
  @ApiProperty({ nullable: true }) error?: string | null;
}
