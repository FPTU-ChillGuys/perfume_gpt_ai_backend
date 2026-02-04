export class PagedResult<T> {
  items: T[];

  // Pagination metadata
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;

  // Optional: Flags for client-side convenience
  get hasPreviousPage(): boolean {
    return this.pageNumber > 1;
  }

  get hasNextPage(): boolean {
    return this.pageNumber < this.totalPages;
  }

  constructor(init?: Partial<PagedResult<T>>) {
    Object.assign(this, init);
  }
}
