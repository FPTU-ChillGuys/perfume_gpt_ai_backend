import { ApiProperty } from '@nestjs/swagger';

export class OrderListItemResponse {
  @ApiProperty({
    description: 'Order creation date',
    example: '2024-01-01T00:00:00.000Z'
  })
  createdAt: string;

  @ApiProperty({
    description: 'Customer ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true
  })
  customerId: string | null;

  @ApiProperty({
    description: 'Customer name',
    example: 'John Doe',
    nullable: true
  })
  customerName: string | null;

  @ApiProperty({
    description: 'Order ID',
    example: '550e8400-e29b-41d4-a716-446655440001'
  })
  id: string;

  @ApiProperty({
    description: 'Order code',
    example: 'ORD-20260408-0001'
  })
  code: string;

  @ApiProperty({ description: 'Number of items in the order', example: 3 })
  itemCount: number;

  @ApiProperty({
    description: 'Payment status of the order',
    enum: ['Unpaid', 'Paid', 'Refunded'],
    example: 'Unpaid'
  })
  paymentStatus: 'Unpaid' | 'Paid' | 'Refunded';

  @ApiProperty({
    description: 'Shipping status code',
    example: 1,
    nullable: true
  })
  shippingStatus: number | null;

  @ApiProperty({
    description: 'Staff ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
    nullable: true
  })
  staffId: string | null;

  @ApiProperty({
    description: 'Staff name',
    example: 'Jane Smith',
    nullable: true
  })
  staffName: string | null;

  @ApiProperty({
    description: 'Order status',
    enum: [
      'Pending',
      'Processing',
      'Shipped',
      'Delivered',
      'Canceled',
      'Returned'
    ],
    example: 'Pending'
  })
  status:
    | 'Pending'
    | 'Processing'
    | 'Shipped'
    | 'Delivered'
    | 'Canceled'
    | 'Returned';

  @ApiProperty({ description: 'Total amount of the order', example: 150000 })
  totalAmount: number;

  @ApiProperty({
    description: 'Order type',
    enum: ['Online', 'Offline', 'Shoppe'],
    example: 'Online'
  })
  type: 'Online' | 'Offline' | 'Shoppe';

  @ApiProperty({
    description: 'Order last updated date',
    example: '2024-01-02T00:00:00.000Z',
    nullable: true
  })
  updatedAt: string | null;

  constructor(init?: Partial<OrderListItemResponse>) {
    Object.assign(this, init);
  }
}

export class OrderDetailResponse {
  @ApiProperty({ description: 'Order detail ID', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Image URL', nullable: true })
  imageUrl: string | null;

  @ApiProperty({ description: 'Quantity', example: 1 })
  quantity: number;

  @ApiProperty({ description: 'Total price', example: 150000 })
  total: number;

  @ApiProperty({ description: 'Unit price', example: 50000 })
  unitPrice: number;

  @ApiProperty({ description: 'Variant ID', format: 'uuid' })
  variantId: string;

  @ApiProperty({ description: 'Variant name' })
  variantName: string;

  constructor(init?: Partial<OrderDetailResponse>) {
    Object.assign(this, init);
  }
}

export class OrderResponse {
  @ApiProperty({
    description: 'Order creation date',
    example: '2017-07-21T17:32:28Z'
  })
  createdAt: string;

  @ApiProperty({
    description: 'Customer email',
    nullable: true
  })
  customerEmail: string | null;

  @ApiProperty({
    description: 'Customer ID',
    nullable: true
  })
  customerId: string | null;

  @ApiProperty({
    description: 'Customer name',
    nullable: true
  })
  customerName: string | null;

  @ApiProperty({
    description: 'Order ID'
  })
  id: string;

  @ApiProperty({
    description: 'Order code',
    example: 'ORD-20260408-0001'
  })
  code: string;

  @ApiProperty({
    description: 'Order details',
    type: () => [OrderDetailResponse]
  })
  orderDetails: OrderDetailResponse[];

  @ApiProperty({
    description: 'Paid at date',
    nullable: true
  })
  paidAt: string | null;

  @ApiProperty({
    description: 'Payment expiration date',
    nullable: true
  })
  paymentExpiresAt: string | null;

  @ApiProperty({
    description: 'Payment status',
    enum: ['Unpaid', 'Paid', 'Refunded'],
    example: 'Unpaid'
  })
  paymentStatus: 'Unpaid' | 'Paid' | 'Refunded';

  @ApiProperty({
    description: 'Recipient information',
    nullable: true,
    type: Object
  })
  recipientInfo: Record<string, any> | null;

  @ApiProperty({
    description: 'Shipping information',
    nullable: true,
    type: Object
  })
  shippingInfo: Record<string, any> | null;

  @ApiProperty({
    description: 'Staff ID',
    nullable: true
  })
  staffId: string | null;

  @ApiProperty({
    description: 'Staff name',
    nullable: true
  })
  staffName: string | null;

  @ApiProperty({
    description: 'Order status',
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Canceled', 'Returned'],
    example: 'Pending'
  })
  orderStatus: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Canceled' | 'Returned';

  @ApiProperty({
    description: 'Total amount of the order',
    example: 150000
  })
  totalAmount: number;

  @ApiProperty({
    description: 'Order type',
    enum: ['Online', 'Offline', 'Shoppe'],
    example: 'Online'
  })
  type: 'Online' | 'Offline' | 'Shoppe';

  @ApiProperty({
    description: 'Order last updated date',
    nullable: true
  })
  updatedAt: string | null;

  @ApiProperty({
    description: 'Voucher code',
    nullable: true
  })
  voucherCode: string | null;

  @ApiProperty({
    description: 'Voucher ID',
    nullable: true
  })
  voucherId: string | null;

  constructor(init?: Partial<OrderResponse>) {
    Object.assign(this, init);
  }
}
