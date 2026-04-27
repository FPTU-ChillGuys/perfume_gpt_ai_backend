import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductCardVariantOutputResponse {
    @ApiProperty({ format: 'uuid' })
    id!: string;

    @ApiProperty()
    sku!: string;

    @ApiProperty()
    volumeMl!: number;

    @ApiProperty()
    basePrice!: number;
}

export class ProductCardOutputItemResponse {
    @ApiProperty({ format: 'uuid' })
    id!: string;

    @ApiProperty()
    name!: string;

    @ApiProperty()
    brandName!: string;

    @ApiPropertyOptional({ nullable: true })
    primaryImage!: string | null;

    @ApiProperty({ type: [ProductCardVariantOutputResponse] })
    variants!: ProductCardVariantOutputResponse[];

    @ApiPropertyOptional({ nullable: true })
    reasoning!: string | null;

    @ApiPropertyOptional({ nullable: true })
    source!: string | null;
}

export class ProductTempItemResponse {
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

/** Class response cho nội dung tin nhắn Assistant (đã parse) */
export class ConversationOutputResponse {
    @ApiProperty({ description: 'Nội dung tin nhắn văn bản' })
    message!: string;

    @ApiPropertyOptional({ type: [ProductCardOutputItemResponse], nullable: true })
    products!: ProductCardOutputItemResponse[] | null;

    @ApiPropertyOptional({ type: [ProductTempItemResponse], nullable: true })
    productTemp!: ProductTempItemResponse[] | null;

    @ApiProperty({ type: [String], description: 'Gợi ý 3-4 câu hỏi tiếp theo' })
    suggestedQuestions!: string[];
}
