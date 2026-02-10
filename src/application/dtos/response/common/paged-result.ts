import { ApiProperty } from '@nestjs/swagger';

/** Kết quả phân trang */
export class PagedResult<T> {
  /** Danh sách bản ghi trong trang hiện tại */
  @ApiProperty({ description: 'Danh sách bản ghi' })
  items: T[];

  /** Số trang hiện tại */
  @ApiProperty({ description: 'Số trang hiện tại' })
  pageNumber: number;

  /** Số bản ghi mỗi trang */
  @ApiProperty({ description: 'Số bản ghi mỗi trang' })
  pageSize: number;

  /** Tổng số bản ghi */
  @ApiProperty({ description: 'Tổng số bản ghi' })
  totalCount: number;

  /** Tổng số trang */
  @ApiProperty({ description: 'Tổng số trang' })
  totalPages: number;

  /** Có trang trước hay không */
  get hasPreviousPage(): boolean {
    return this.pageNumber > 1;
  }

  /** Có trang sau hay không */
  get hasNextPage(): boolean {
    return this.pageNumber < this.totalPages;
  }

  constructor(init?: Partial<PagedResult<T>>) {
    Object.assign(this, init);
  }
}
