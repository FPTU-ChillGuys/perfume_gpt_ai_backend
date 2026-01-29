import { ApiProperty } from '@nestjs/swagger';

export class ProductResponse {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  brandId!: number;
  @ApiProperty()
  brandName!: string;
  @ApiProperty()
  categoryId!: number;
  @ApiProperty()
  categoryName!: string;
  @ApiProperty()
  familyId!: number | null;
  @ApiProperty()
  familyName!: string | null;
  @ApiProperty()
  description!: string;
  @ApiProperty()
  topNotes!: string;
  @ApiProperty()
  middleNotes!: string;
  @ApiProperty()
  baseNotes!: string;
}

export class ProductListResponse {
  @ApiProperty({ type: [ProductResponse] })
  items!: ProductResponse[];
}
