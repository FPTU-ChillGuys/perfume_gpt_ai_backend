import { ApiProperty } from '@nestjs/swagger';

export class NatsCartItemResponse {
  @ApiProperty()
    cartItemId!: string;
  @ApiProperty()
    variantId!: string;
  @ApiProperty()
    variantName!: string;
  @ApiProperty()
    imageUrl!: string;
  @ApiProperty()
    volumeMl!: number;
  @ApiProperty()
    type!: string;
  @ApiProperty()
    variantPrice!: number;
  @ApiProperty()
    quantity!: number;
  @ApiProperty()
    isAvailable!: boolean;
  @ApiProperty()
    subTotal!: number;
  @ApiProperty()
    promotionalQuantity!: number;
  @ApiProperty()
    regularQuantity!: number;
  @ApiProperty()
    discount!: number;
  @ApiProperty()
    finalTotal!: number;
}

export class NatsCartResponse {
  @ApiProperty({ type: [NatsCartItemResponse] })
    items!: NatsCartItemResponse[];
  @ApiProperty()
    totalCount!: number;
  @ApiProperty()
    totalAmount!: number;
  @ApiProperty()
    totalDiscount!: number;
  @ApiProperty()
    finalTotal!: number;
}

export class NatsCartMutationResponse {
  @ApiProperty()
    success!: boolean;
  @ApiProperty({ nullable: true }) error?: string | null;
  @ApiProperty({ nullable: true }) message?: string | null;
  @ApiProperty({ nullable: true, type: NatsCartItemResponse }) item?: NatsCartItemResponse | null;
}
