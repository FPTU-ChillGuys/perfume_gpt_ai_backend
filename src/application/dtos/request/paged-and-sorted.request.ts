import { ApiProperty } from '@nestjs/swagger';

export class PagedAndSortedRequest {
  @ApiProperty()
  PageNumber: number = 1;
  @ApiProperty()
  PageSize: number = 10;
  @ApiProperty()
  SortBy: string = '';
  @ApiProperty()
  SortOrder: 'asc' | 'desc' = 'asc';
  @ApiProperty()
  IsDescending: boolean = false;
}
