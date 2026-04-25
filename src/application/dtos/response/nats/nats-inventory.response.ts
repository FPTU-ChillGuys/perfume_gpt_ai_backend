import { ApiProperty } from '@nestjs/swagger';

export class NatsInventoryStockResponse {
  @ApiProperty()
    concentrationName!: string;
  @ApiProperty()
    basePrice!: number;
  @ApiProperty()
    id!: string;
  @ApiProperty()
    isLowStock!: boolean;
  @ApiProperty()
    lowStockThreshold!: number;
  @ApiProperty()
    productName!: string;
  @ApiProperty()
    totalQuantity!: number;
  @ApiProperty()
    variantId!: string;
  @ApiProperty()
    variantSku!: string;
  @ApiProperty()
    volumeMl!: number;
  @ApiProperty()
    availableQuantity!: number;
  @ApiProperty()
    variantStatus!: string;
  @ApiProperty()
    status!: string;
  @ApiProperty()
    type!: string;
  @ApiProperty()
    reservedQuantity!: number;
}

export class NatsInventoryPagedResponse {
  @ApiProperty()
    totalCount!: number;
  @ApiProperty()
    pageNumber!: number;
  @ApiProperty()
    pageSize!: number;
  @ApiProperty()
    totalPages!: number;
  @ApiProperty({ type: [NatsInventoryStockResponse] })
    items!: NatsInventoryStockResponse[];
}

export class NatsInventoryOverallStats {
  @ApiProperty()
    totalSku!: number;
  @ApiProperty()
    lowStockSku!: number;
  @ApiProperty()
    outOfStockSku!: number;
  @ApiProperty()
    expiredBatches!: number;
  @ApiProperty()
    nearExpiryBatches!: number;
  @ApiProperty()
    criticalAlerts!: number;
}
