import { ApiProperty } from '@nestjs/swagger';

export class NatsProductMediaResponse {
  @ApiProperty()
    id!: string;
  @ApiProperty()
    url!: string;
  @ApiProperty({ nullable: true })
    thumbnailUrl!: string | null;
  @ApiProperty()
    type!: string;
}

export class NatsProductVariantResponse {
  @ApiProperty()
    id!: string;
  @ApiProperty()
    sku!: string;
  @ApiProperty()
    volumeMl!: number;
  @ApiProperty()
    concentrationName!: string;
  @ApiProperty()
    type!: string;
  @ApiProperty()
    basePrice!: number;
  @ApiProperty({ nullable: true })
    retailPrice!: number | null;
  @ApiProperty()
    stockQuantity!: number;
  @ApiProperty()
    productName!: string;
  @ApiProperty({ type: [NatsProductMediaResponse] })
    media: NatsProductMediaResponse[] = [];
  @ApiProperty({ nullable: true })
    campaignName!: string | null;
  @ApiProperty({ nullable: true })
    voucherCode!: string | null;
  @ApiProperty({ nullable: true })
    discountedPrice!: number | null;
}

export class NatsProductAttributeResponse {
  @ApiProperty()
    attributeId!: number;
  @ApiProperty()
    name!: string;
  @ApiProperty()
    value!: string;
}

export class NatsProductOlfactoryFamilyResponse {
  @ApiProperty()
    olfactoryFamilyId!: number;
  @ApiProperty()
    name!: string;
}

export class NatsProductScentNoteResponse {
  @ApiProperty()
    noteId!: number;
  @ApiProperty()
    name!: string;
  @ApiProperty()
    noteType!: string;
}

export class NatsProductResponse {
  @ApiProperty()
    id!: string;
  @ApiProperty({ nullable: true })
    name!: string | null;
  @ApiProperty()
    gender!: string;
  @ApiProperty()
    origin!: string;
  @ApiProperty()
    releaseYear!: number;
  @ApiProperty()
    brandId!: number;
  @ApiProperty()
    brandName!: string;
  @ApiProperty()
    categoryId!: number;
  @ApiProperty()
    categoryName!: string;
  @ApiProperty({ nullable: true })
    description!: string | null;
  @ApiProperty()
    numberOfVariants!: number;
  @ApiProperty({ type: [NatsProductMediaResponse] })
    media: NatsProductMediaResponse[] = [];
  @ApiProperty({ type: [NatsProductVariantResponse] })
    variants: NatsProductVariantResponse[] = [];
  @ApiProperty({ type: [NatsProductAttributeResponse] })
    attributes: NatsProductAttributeResponse[] = [];
  @ApiProperty({ type: [NatsProductOlfactoryFamilyResponse] })
    olfactoryFamilies: NatsProductOlfactoryFamilyResponse[] = [];
  @ApiProperty({ type: [NatsProductScentNoteResponse] })
    scentNotes: NatsProductScentNoteResponse[] = [];
}

export class NatsProductByIdsResponse {
  @ApiProperty({ type: [NatsProductResponse] })
    items: NatsProductResponse[] = [];
}
