import { ApiProperty } from '@nestjs/swagger';

export class NatsReviewMediaResponse {
  @ApiProperty()
    id!: string;
  @ApiProperty()
    url!: string;
  @ApiProperty({ nullable: true })
    thumbnailUrl!: string | null;
  @ApiProperty()
    type!: string;
}

export class NatsReviewListItemResponse {
  @ApiProperty()
    id!: string;
  @ApiProperty()
    userId!: string;
  @ApiProperty()
    userFullName!: string;
  @ApiProperty({ nullable: true })
    userProfilePictureUrl!: string | null;
  @ApiProperty()
    orderDetailId!: string;
  @ApiProperty()
    variantId!: string;
  @ApiProperty()
    variantName!: string;
  @ApiProperty()
    rating!: number;
  @ApiProperty()
    comment!: string;
  @ApiProperty({ nullable: true })
    staffFeedbackComment!: string | null;
  @ApiProperty({ nullable: true })
    staffFeedbackAt!: string | null;
  @ApiProperty({ type: [NatsReviewMediaResponse] })
    images!: NatsReviewMediaResponse[];
  @ApiProperty()
    createdAt!: string;
  @ApiProperty({ nullable: true })
    updatedAt!: string | null;
}

export class NatsReviewPagedResponse {
  @ApiProperty()
    totalCount!: number;
  @ApiProperty()
    pageNumber!: number;
  @ApiProperty()
    pageSize!: number;
  @ApiProperty()
    totalPages!: number;
  @ApiProperty({ type: [NatsReviewListItemResponse] })
    items!: NatsReviewListItemResponse[];
}

export class NatsReviewVariantStats {
  @ApiProperty()
    variantId!: string;
  @ApiProperty()
    totalReviews!: number;
  @ApiProperty()
    averageRating!: number;
  @ApiProperty()
    fiveStarCount!: number;
  @ApiProperty()
    fourStarCount!: number;
  @ApiProperty()
    threeStarCount!: number;
  @ApiProperty()
    twoStarCount!: number;
  @ApiProperty()
    oneStarCount!: number;
}
