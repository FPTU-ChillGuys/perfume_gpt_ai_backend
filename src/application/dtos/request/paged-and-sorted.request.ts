export class PagedAndSortedRequest {
  PageNumber: number = 1;
  PageSize: number = 10;
  SortBy: string = '';
  SortOrder: 'asc' | 'desc' = 'asc';
  IsDescending: boolean = false;
}
