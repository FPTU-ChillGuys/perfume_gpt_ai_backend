import { ApiPropertyOptional } from '@nestjs/swagger';
import { PagedAndSortedRequest } from "./paged-and-sorted.request";

/** Request lấy danh sách đánh giá (phân trang) */
export class GetPagedReviewRequest extends PagedAndSortedRequest{
	/** ID variant sản phẩm */
	@ApiPropertyOptional({ description: 'ID variant sản phẩm', format: 'uuid' })
	VariantId?: string;

	/** ID người dùng */
	@ApiPropertyOptional({ description: 'ID người dùng', format: 'uuid' })
	UserId?: string;

	/** Trạng thái đánh giá */
	@ApiPropertyOptional({ description: 'Trạng thái đánh giá', enum: ['Pending', 'Approved', 'Rejected'] })
	Status?: string;

	/** Số sao tối thiểu */
	@ApiPropertyOptional({ description: 'Số sao tối thiểu', minimum: 1, maximum: 5 })
	MinRating?: number;

	/** Số sao tối đa */
	@ApiPropertyOptional({ description: 'Số sao tối đa', minimum: 1, maximum: 5 })
	MaxRating?: number;

	/** Lọc đánh giá có hình ảnh */
	@ApiPropertyOptional({ description: 'Chỉ lấy đánh giá có hình ảnh' })
	HasImages?: boolean;
}