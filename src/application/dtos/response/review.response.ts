import { ApiProperty } from '@nestjs/swagger';

/** Response danh sách đánh giá (dạng rút gọn) */
export class ReviewListItemResponse {
    /** Xem trước nội dung đánh giá */
    @ApiProperty({ description: 'Xem trước nội dung đánh giá' })
    commentPreview: string;

    /** Ngày tạo đánh giá */
    @ApiProperty({ description: 'Ngày tạo đánh giá', format: 'date-time' })
    createdAt: string;

    /** ID đánh giá */
    @ApiProperty({ description: 'ID đánh giá', format: 'uuid' })
    id: string;

    /** Số lượng hình ảnh đính kèm */
    @ApiProperty({ description: 'Số lượng hình ảnh' })
    imageCount: number;

    /** Số sao đánh giá (1-5) */
    @ApiProperty({ description: 'Số sao đánh giá', minimum: 1, maximum: 5 })
    rating: number;

    /** Trạng thái đánh giá */
    @ApiProperty({ description: 'Trạng thái đánh giá', enum: ['Pending', 'Approved', 'Rejected'] })
    status: 'Pending' | 'Approved' | 'Rejected';

    /** Tên đầy đủ người đánh giá */
    @ApiProperty({ description: 'Tên người đánh giá' })
    userFullName: string;

    /** ID người đánh giá */
    @ApiProperty({ description: 'ID người đánh giá', format: 'uuid' })
    userId: string;

    /** URL ảnh đại diện người đánh giá */
    @ApiProperty({ description: 'URL ảnh đại diện', nullable: true })
    userProfilePictureUrl: string | null;

    /** ID variant sản phẩm */
    @ApiProperty({ description: 'ID variant sản phẩm', format: 'uuid' })
    variantId: string;

    /** Tên variant sản phẩm */
    @ApiProperty({ description: 'Tên variant sản phẩm' })
    variantName: string;
}

/** Response chi tiết đánh giá sản phẩm */
export class ReviewResponse {
	/** ID đánh giá */
	@ApiProperty({ description: 'ID đánh giá', format: 'uuid' })
	id: string;

	/** ID người đánh giá */
	@ApiProperty({ description: 'ID người đánh giá', format: 'uuid' })
	userId: string;

	/** Tên đầy đủ người đánh giá */
	@ApiProperty({ description: 'Tên người đánh giá' })
	userFullName: string;

	/** URL ảnh đại diện */
	@ApiProperty({ description: 'URL ảnh đại diện', nullable: true })
	userProfilePictureUrl: string | null;

	/** ID chi tiết đơn hàng */
	@ApiProperty({ description: 'ID chi tiết đơn hàng', format: 'uuid' })
	orderDetailId: string;

	/** ID variant sản phẩm */
	@ApiProperty({ description: 'ID variant sản phẩm', format: 'uuid' })
	variantId: string;

	/** Tên variant sản phẩm */
	@ApiProperty({ description: 'Tên variant sản phẩm' })
	variantName: string;

	/** Số sao đánh giá (1-5) */
	@ApiProperty({ description: 'Số sao đánh giá', minimum: 1, maximum: 5 })
	rating: number;

	/** Nội dung đánh giá */
	@ApiProperty({ description: 'Nội dung đánh giá' })
	comment: string;

	/** Trạng thái đánh giá */
	@ApiProperty({ description: 'Trạng thái đánh giá', enum: ['Pending', 'Approved', 'Rejected'] })
	status: 'Pending' | 'Approved' | 'Rejected';

	/** Danh sách hình ảnh đính kèm */
	@ApiProperty({ description: 'Danh sách hình ảnh', type: () => [MediaResponse] })
	images: MediaResponse[];

	/** Ngày tạo đánh giá */
	@ApiProperty({ description: 'Ngày tạo', format: 'date-time' })
	createdAt: string;

	/** Ngày cập nhật gần nhất */
	@ApiProperty({ description: 'Ngày cập nhật', format: 'date-time', nullable: true })
	updatedAt: string | null;
}

/** Response media (hình ảnh) đính kèm đánh giá */
export class MediaResponse {
	/** ID media */
	@ApiProperty({ description: 'ID media', format: 'uuid' })
	id: string;

	/** URL hình ảnh */
	@ApiProperty({ description: 'URL hình ảnh' })
	url: string;

	/** Mô tả thay thế */
	@ApiProperty({ description: 'Mô tả thay thế (alt text)', nullable: true })
	altText: string | null;

	/** Thứ tự hiển thị */
	@ApiProperty({ description: 'Thứ tự hiển thị' })
	displayOrder: number;

	/** Có phải ảnh chính không */
	@ApiProperty({ description: 'Ảnh chính hay không' })
	isPrimary: boolean;

	/** Kích thước file (bytes) */
	@ApiProperty({ description: 'Kích thước file (bytes)', nullable: true })
	fileSize: number | null;

	/** Loại MIME */
	@ApiProperty({ description: 'Loại MIME (image/jpeg, ...)', nullable: true })
	mimeType: string | null;
}

/** Response thống kê đánh giá theo variant */
export class ReviewStatisticsResponse {
	/** ID variant sản phẩm */
	@ApiProperty({ description: 'ID variant sản phẩm', format: 'uuid' })
	variantId: string;

	/** Tổng số đánh giá */
	@ApiProperty({ description: 'Tổng số đánh giá' })
	totalReviews: number;

	/** Số sao trung bình */
	@ApiProperty({ description: 'Số sao trung bình' })
	averageRating: number;

	/** Số đánh giá 5 sao */
	@ApiProperty({ description: 'Số đánh giá 5 sao' })
	fiveStarCount: number;

	/** Số đánh giá 4 sao */
	@ApiProperty({ description: 'Số đánh giá 4 sao' })
	fourStarCount: number;

	/** Số đánh giá 3 sao */
	@ApiProperty({ description: 'Số đánh giá 3 sao' })
	threeStarCount: number;

	/** Số đánh giá 2 sao */
	@ApiProperty({ description: 'Số đánh giá 2 sao' })
	twoStarCount: number;

	/** Số đánh giá 1 sao */
	@ApiProperty({ description: 'Số đánh giá 1 sao' })
	oneStarCount: number;
}
