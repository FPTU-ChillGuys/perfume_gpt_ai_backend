import { ApiProperty } from '@nestjs/swagger';

export class ProductCardVariantResponse {
  @ApiProperty({ description: 'ID variant', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'SKU variant' })
  sku!: string;

  @ApiProperty({ description: 'Dung tich cua variant (ml)', example: 100 })
  volumeMl!: number;

  @ApiProperty({ description: 'Gia goc cua variant', example: 1780000 })
  basePrice!: number;
}

export class ProductCardResponse {
  @ApiProperty({ description: 'ID san pham', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Ten san pham' })
  name!: string;

  @ApiProperty({ description: 'Ten thuong hieu' })
  brandName!: string;

  @ApiProperty({ description: 'Anh chinh cua san pham', nullable: true })
  primaryImage!: string | null;

  @ApiProperty({ description: 'Danh sach variants da sap xep theo uu tien ban chay', type: [ProductCardVariantResponse] })
  variants!: ProductCardVariantResponse[];

  @ApiProperty({ description: 'So luong size hien co', example: 4 })
  sizesCount!: number;

  @ApiProperty({ description: 'Gia hien thi cua variant uu tien', example: 2280000 })
  displayPrice!: number;
}
