export class PagedAndSortedRequest {
  PageNumber!: number;
  PageSize!: number;
  SortBy!: string;
  SortOrder!: 'asc' | 'desc';
  IsDescending!: boolean;
}
