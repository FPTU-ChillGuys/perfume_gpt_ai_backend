import { ApiProperty } from '@nestjs/swagger';

export class NatsDailySalesRecord {
  @ApiProperty()
    date!: string;
  @ApiProperty()
    quantitySold!: number;
  @ApiProperty()
    revenue!: number;
}

export class NatsSalesAnalyticsResponse {
  @ApiProperty()
    variantId!: string;
  @ApiProperty()
    totalQuantitySold!: number;
  @ApiProperty()
    totalRevenue!: number;
  @ApiProperty()
    averageDailySales!: number;
  @ApiProperty()
    last7DaysSales!: number;
  @ApiProperty()
    last30DaysSales!: number;
  @ApiProperty()
    trend!: string;
  @ApiProperty()
    volatility!: string;
  @ApiProperty()
    sku!: string;
  @ApiProperty()
    productName!: string;
  @ApiProperty()
    volumeMl!: number;
  @ApiProperty()
    type!: string;
  @ApiProperty()
    basePrice!: number;
  @ApiProperty()
    status!: string;
  @ApiProperty()
    concentrationName!: string;
  @ApiProperty({ type: [NatsDailySalesRecord] })
    dailySalesData: NatsDailySalesRecord[] = [];
}
