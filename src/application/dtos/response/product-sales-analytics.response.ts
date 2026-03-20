import { ApiProperty } from '@nestjs/swagger';
import { ProductAttributeResponse } from './product.response';

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

/** Response thông tin sản phẩm với dữ liệu bán hàng theo ngày */
export class ProductSalesAnalyticsResponse {
  /** ID sản phẩm */
  @ApiProperty({ description: 'ID sản phẩm', format: 'uuid' })
  id: string;

  /** Tên sản phẩm */
  @ApiProperty({ description: 'Tên sản phẩm' })
  name: string;

  /** ID thương hiệu */
  @ApiProperty({ description: 'ID thương hiệu' })
  brandId: number;

  /** Tên thương hiệu */
  @ApiProperty({ description: 'Tên thương hiệu' })
  brandName: string;

  /** ID danh mục */
  @ApiProperty({ description: 'ID danh mục' })
  categoryId: number;

  /** Tên danh mục */
  @ApiProperty({ description: 'Tên danh mục' })
  categoryName: string;

  /** Mô tả sản phẩm */
  @ApiProperty({ description: 'Mô tả sản phẩm' })
  description: string;

  /** URL hình ảnh chính */
  @ApiProperty({ description: 'URL hình ảnh chính', nullable: true })
  primaryImage: string | null;

  /** Danh sách thuộc tính sản phẩm */
  @ApiProperty({
    description: 'Danh sách thuộc tính sản phẩm',
    type: [ProductAttributeResponse]
  })
  attributes: ProductAttributeResponse[];

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

  constructor(init?: Partial<ProductSalesAnalyticsResponse>) {
    Object.assign(this, init);
  }
}
