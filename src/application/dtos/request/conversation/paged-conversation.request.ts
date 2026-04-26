import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PagedAndSortedRequest } from '../paged-and-sorted.request';

/** Request lấy danh sách cuộc hội thoại có phân trang */
export class PagedConversationRequest extends PagedAndSortedRequest {
  /** Lọc theo ID người dùng */
  @ApiProperty({ description: 'ID người dùng', required: false })
  @IsOptional()
  @IsString()
  userId?: string;
}
