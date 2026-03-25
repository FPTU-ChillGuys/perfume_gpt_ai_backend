import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { PagedAndSortedRequest } from './paged-and-sorted.request';

enum OrderStatus {
  Pending = 'Pending',
  Processing = 'Processing',
  Shipped = 'Shipped',
  Delivered = 'Delivered',
  Canceled = 'Canceled',
  Returned = 'Returned',
}

enum OrderType {
  Online = 'Online',
  Offline = 'Offline',
  Shoppe = 'Shoppe',
}

enum PaymentStatus {
  Unpaid = 'Unpaid',
  Paid = 'Paid',
  Refunded = 'Refunded',
}

export class OrderRequest extends PagedAndSortedRequest {
  @ApiPropertyOptional({ enum: OrderStatus, description: 'Trạng thái đơn hàng', example: OrderStatus.Pending })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: OrderType, description: 'Loại đơn hàng', example: OrderType.Online })
  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;

  @ApiPropertyOptional({ enum: PaymentStatus, description: 'Trạng thái thanh toán', example: PaymentStatus.Unpaid })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Ngày bắt đầu (ISO 8601)', example: '2024-01-01' })
  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Ngày kết thúc (ISO 8601)', example: '2024-12-31' })
  @IsOptional()
  @IsISO8601()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm', example: 'perfume' })
  @IsOptional()
  @IsString()
  searchTerm?: string;

  constructor(init?: Partial<OrderRequest>) {
    super();
    Object.assign(this, init);
  }
}
