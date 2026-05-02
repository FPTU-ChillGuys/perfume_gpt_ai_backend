import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductCardVariantOutputDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  volumeMl!: number;

  @ApiProperty()
  basePrice!: number;
}

export class ProductCardOutputItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  brandName!: string;

  @ApiPropertyOptional({ nullable: true })
  primaryImage!: string | null;

  @ApiProperty({ type: [ProductCardVariantOutputDto] })
  variants!: ProductCardVariantOutputDto[];

  @ApiPropertyOptional({ nullable: true })
  reasoning!: string | null;

  @ApiPropertyOptional({ nullable: true })
  source!: string | null;
}

export class ProductTempItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        price: { type: 'number' }
      }
    },
    nullable: true
  })
  variants!: { id: string; price: number }[] | null;

  @ApiProperty()
  reasoning!: string;

  @ApiProperty()
  source!: string;
}

/** Class DTO cho nội dung tin nhắn Assistant (dùng cho cả Req/Res) */
export class ConversationOutputDto {
  @ApiProperty({ description: 'Nội dung tin nhắn văn bản' })
  message!: string;

  @ApiPropertyOptional({ type: [ProductCardOutputItemDto], nullable: true })
  products!: ProductCardOutputItemDto[] | null;

  @ApiPropertyOptional({ type: [ProductTempItemDto], nullable: true })
  productTemp!: ProductTempItemDto[] | null;

  @ApiProperty({
    type: [String],
    description: 'Gợi ý 3-4 câu hỏi tiếp theo',
    nullable: true
  })
  suggestedQuestions?: string[];
}
