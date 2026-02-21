import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Request phân trang danh sách cuộc hội thoại */
export class PagedConversationRequest {
  /** Số trang (bắt đầu từ 1) */
  @ApiProperty({ description: 'Số trang (bắt đầu từ 1)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  pageNumber: number = 1;

  /** Số bản ghi mỗi trang */
  @ApiProperty({ description: 'Số bản ghi mỗi trang', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize: number = 10;

  /** Lọc theo user ID (tùy chọn) */
  @ApiPropertyOptional({ description: 'Lọc theo user ID', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  constructor(init?: Partial<PagedConversationRequest>) {
    Object.assign(this, init);
  }
}
