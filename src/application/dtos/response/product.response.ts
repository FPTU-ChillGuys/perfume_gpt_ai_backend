import { ApiProperty } from '@nestjs/swagger';

/** Response thuộc tính sản phẩm nước hoa */
export class ProductAttributeResponse {
  /** ID bản ghi thuộc tính */
  @ApiProperty({ description: 'ID bản ghi thuộc tính', format: 'uuid' })
  id!: string;

  /** ID thuộc tính */
  @ApiProperty({ description: 'ID thuộc tính' })
  attributeId!: number;

  /** ID giá trị thuộc tính */
  @ApiProperty({ description: 'ID giá trị thuộc tính' })
  valueId!: number;

  /** Tên thuộc tính (vd: Weather, Mood, Gender, Base Note...) */
  @ApiProperty({ description: 'Tên thuộc tính', example: 'Weather' })
  attribute!: string;

  /** Mô tả thuộc tính */
  @ApiProperty({ description: 'Mô tả thuộc tính', example: 'Suitable weather or season for the product' })
  description!: string;

  /** Giá trị thuộc tính (vd: Winter, Confident, Unisex, Sandalwood...) */
  @ApiProperty({ description: 'Giá trị thuộc tính', example: 'Winter' })
  value!: string;
}

/** Response thông tin sản phẩm nước hoa */
export class ProductResponse {
  /** ID sản phẩm */
  @ApiProperty({ description: 'ID sản phẩm', format: 'uuid' })
  id!: string;

  /** Tên sản phẩm */
  @ApiProperty({ description: 'Tên sản phẩm' })
  name!: string;

  /** ID thương hiệu */
  @ApiProperty({ description: 'ID thương hiệu' })
  brandId!: number;

  /** Tên thương hiệu */
  @ApiProperty({ description: 'Tên thương hiệu' })
  brandName!: string;

  /** ID danh mục */
  @ApiProperty({ description: 'ID danh mục' })
  categoryId!: number;

  /** Tên danh mục */
  @ApiProperty({ description: 'Tên danh mục' })
  categoryName!: string;

  /** Mô tả sản phẩm */
  @ApiProperty({ description: 'Mô tả sản phẩm' })
  description!: string;

  /** URL hình ảnh chính */
  @ApiProperty({ description: 'URL hình ảnh chính', nullable: true })
  primaryImage!: string | null;

  /** Danh sách thuộc tính sản phẩm (hương, thời tiết, phong cách, ...) */
  @ApiProperty({ description: 'Danh sách thuộc tính sản phẩm', type: [ProductAttributeResponse] })
  attributes!: ProductAttributeResponse[];
}

