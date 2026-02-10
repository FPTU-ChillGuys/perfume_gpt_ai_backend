import { ApiProperty } from '@nestjs/swagger';

/** Request cơ sở cho phân trang và sắp xếp */
export class PagedAndSortedRequest {
  /** Số trang (bắt đầu từ 1) */
  @ApiProperty({ description: 'Số trang', default: 1 })
  PageNumber: number = 1;

  /** Số bản ghi mỗi trang */
  @ApiProperty({ description: 'Số bản ghi mỗi trang', default: 10 })
  PageSize: number = 10;

  /** Trường sắp xếp */
  @ApiProperty({ description: 'Tên trường sắp xếp', default: '' })
  SortBy: string = '';

  /** Thứ tự sắp xếp */
  @ApiProperty({ description: 'Thứ tự sắp xếp', enum: ['asc', 'desc'], default: 'asc' })
  SortOrder: 'asc' | 'desc' = 'asc';

  /** Sắp xếp giảm dần hay không */
  @ApiProperty({ description: 'Sắp xếp giảm dần', default: false })
  IsDescending: boolean = false;
}
