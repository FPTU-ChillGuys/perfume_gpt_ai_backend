import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Request phân trang danh sách cuộc hội thoại */
export class PagedConversationRequest {
  /** Số trang (bắt đầu từ 1) */
  @ApiProperty({ description: 'Số trang (bắt đầu từ 1)', default: 1 })
  pageNumber: number = 1;

  /** Số bản ghi mỗi trang */
  @ApiProperty({ description: 'Số bản ghi mỗi trang', default: 10 })
  pageSize: number = 10;

  /** Lọc theo user ID (tùy chọn) */
  @ApiPropertyOptional({ description: 'Lọc theo user ID', format: 'uuid' })
  userId?: string;

  constructor(init?: Partial<PagedConversationRequest>) {
    Object.assign(this, init);
  }
}
