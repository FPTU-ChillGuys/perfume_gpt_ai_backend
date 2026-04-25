import { ApiProperty } from '@nestjs/swagger';

export class NatsOrderDetailResponse {
  @ApiProperty()
    variantName!: string;
  @ApiProperty()
    quantity!: number;
  @ApiProperty()
    unitPrice!: number;
  @ApiProperty()
    total!: number;
}

export class NatsOrderListItemResponse {
  @ApiProperty()
    createdAt!: string;
  @ApiProperty({ nullable: true })
    customerId!: string | null;
  @ApiProperty({ nullable: true })
    customerName!: string | null;
  @ApiProperty()
    id!: string;
  @ApiProperty()
    code!: string;
  @ApiProperty()
    itemCount!: number;
  @ApiProperty()
    paymentStatus!: string;
  @ApiProperty({ nullable: true })
    shippingStatus!: string | null;
  @ApiProperty({ nullable: true })
    staffId!: string | null;
  @ApiProperty({ nullable: true })
    staffName!: string | null;
  @ApiProperty()
    status!: string;
  @ApiProperty()
    totalAmount!: number;
  @ApiProperty()
    type!: string;
  @ApiProperty({ nullable: true })
    updatedAt!: string | null;
  @ApiProperty({ type: [NatsOrderDetailResponse], nullable: true })
    orderDetails!: NatsOrderDetailResponse[] | null;
}

export class NatsOrderPagedResponse {
  @ApiProperty()
    totalCount!: number;
  @ApiProperty()
    pageNumber!: number;
  @ApiProperty()
    pageSize!: number;
  @ApiProperty()
    totalPages!: number;
  @ApiProperty({ type: [NatsOrderListItemResponse] })
    items: NatsOrderListItemResponse[] = [];
}
