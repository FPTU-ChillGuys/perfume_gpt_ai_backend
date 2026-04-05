import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PagedAndSortedRequest } from './paged-and-sorted.request';

const REVIEW_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;

/** Request lấy danh sách đánh giá (phân trang) */
export class GetPagedReviewRequest extends PagedAndSortedRequest {
  /** ID variant sản phẩm */
  @ApiPropertyOptional({ description: 'ID variant sản phẩm', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  VariantId?: string;

  /** ID người dùng */
  @ApiPropertyOptional({ description: 'ID người dùng', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  UserId?: string;

  /** Trạng thái đánh giá */
  @ApiPropertyOptional({ description: 'Trạng thái đánh giá', enum: REVIEW_STATUSES })
  @IsOptional()
  @IsEnum(REVIEW_STATUSES)
  Status?: string;

  /** Số sao tối thiểu */
  @ApiPropertyOptional({ description: 'Số sao tối thiểu', minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  MinRating?: number;

  /** Số sao tối đa */
  @ApiPropertyOptional({ description: 'Số sao tối đa', minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  MaxRating?: number;

  /** Lọc đánh giá có hình ảnh */
  @ApiPropertyOptional({ description: 'Chỉ lấy đánh giá có hình ảnh' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  HasImages?: boolean;
}
