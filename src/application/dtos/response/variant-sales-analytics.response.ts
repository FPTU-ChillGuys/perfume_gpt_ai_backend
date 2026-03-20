import { ApiProperty } from '@nestjs/swagger';

/** Response cho dữ liệu bán hàng theo ngày */
export class DailySalesRecord {
  /** Ngày bán hàng (định dạng YYYY-MM-DD) */
  @ApiProperty({
    description: 'Ngày bán hàng',
    example: '2024-01-01',
    type: 'string'
  })
  date: string;

  /** Số lượng bán trong ngày */
  @ApiProperty({
    description: 'Số lượng bán trong ngày',
    example: 5,
    type: 'number'
  })
  quantitySold: number;

  /** Doanh thu trong ngày */
  @ApiProperty({
    description: 'Doanh thu trong ngày',
    example: 250000,
    type: 'number'
  })
  revenue: number;
}

/** Response thông tin variant với dữ liệu bán hàng theo ngày */
export class VariantSalesAnalyticsResponse {
  /** ID variant */
  @ApiProperty({ description: 'ID variant', format: 'uuid' })
  variantId: string;

  /** SKU của variant */
  @ApiProperty({ description: 'SKU của variant' })
  sku: string;

  /** Tên sản phẩm */
  @ApiProperty({ description: 'Tên sản phẩm' })
  productName: string;

  /** Dung tích (ml) */
  @ApiProperty({ description: 'Dung tích (ml)', example: 100 })
  volumeMl: number;

  /** Loại variant */
  @ApiProperty({ description: 'Loại variant', example: 'Eau de Parfum' })
  type: string;

  /** Giá gốc */
  @ApiProperty({ description: 'Giá gốc', example: 500000 })
  basePrice: number;

  /** Trạng thái */
  @ApiProperty({ description: 'Trạng thái', example: 'Active' })
  status: string;

  /** Tên nồng độ */
  @ApiProperty({ description: 'Tên nồng độ', nullable: true })
  concentrationName: string | null;

  /** Dữ liệu bán hàng theo ngày (2 tháng gần nhất) */
  @ApiProperty({
    description: 'Dữ liệu bán hàng theo ngày',
    type: [DailySalesRecord]
  })
  dailySalesData: DailySalesRecord[];

  /** Tổng số lượng bán trong 2 tháng */
  @ApiProperty({
    description: 'Tổng số lượng bán trong 2 tháng',
    example: 100,
    type: 'number'
  })
  totalQuantitySold: number;

  /** Tổng doanh thu trong 2 tháng */
  @ApiProperty({
    description: 'Tổng doanh thu trong 2 tháng',
    example: 5000000,
    type: 'number'
  })
  totalRevenue: number;

  /** Trung bình số lượng bán mỗi ngày */
  @ApiProperty({
    description: 'Trung bình số lượng bán mỗi ngày',
    example: 1.6,
    type: 'number'
  })
  averageDailySales: number;

  /** Ngày bắt đầu phân tích */
  @ApiProperty({
    description: 'Ngày bắt đầu phân tích',
    example: '2023-11-01',
    type: 'string'
  })
  periodStartDate: string;

  /** Ngày kết thúc phân tích */
  @ApiProperty({
    description: 'Ngày kết thúc phân tích',
    example: '2024-01-01',
    type: 'string'
  })
  periodEndDate: string;

  /** Số ngày có dữ liệu bán hàng */
  @ApiProperty({
    description: 'Số ngày có dữ liệu bán hàng',
    example: 62,
    type: 'number'
  })
  daysWithSalesCount: number;

  constructor(init?: Partial<VariantSalesAnalyticsResponse>) {
    Object.assign(this, init);
  }
}
