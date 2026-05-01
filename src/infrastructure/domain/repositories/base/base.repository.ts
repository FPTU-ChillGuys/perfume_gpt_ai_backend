import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Common } from 'src/domain/entities/common/common.entities';
import { FilterQuery, FindOptions } from '@mikro-orm/core';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';

/**
 * Repository cơ sở chứa các logic dùng chung cho tất cả repository (MikroORM).
 * Tương đương với GenericRepository trong .NET EF Core.
 */
export abstract class BaseRepository<
  T extends Common
> extends SqlEntityRepository<T> {
  /** Thêm entity mới vào context quản lý */
  add(entity: T): void {
    this.getEntityManager().persist(entity);
  }

  /** Xóa mềm entity (Soft Delete) */
  remove(entity: T): void {
    entity.isActive = false;
    this.getEntityManager().persist(entity);
  }

  /** Xóa vật lý entity khỏi database */
  hardRemove(entity: T): void {
    this.getEntityManager().remove(entity);
  }

  /** Đồng bộ các thay đổi vào database */
  async flush(): Promise<void> {
    await this.getEntityManager().flush();
  }

  /** Thêm và đồng bộ ngay lập tức */
  async addAndFlush(entity: T): Promise<void> {
    this.add(entity);
    await this.flush();
  }

  /** Tìm một bản ghi theo ID */
  async findOneById(
    id: string,
    options?: FindOptions<T, any>
  ): Promise<T | null> {
    return this.findOne({ id } as FilterQuery<T>, options as any);
  }

  /**
   * Truy vấn phân trang dựa trên PagedAndSortedRequest.
   * Hỗ trợ logic "AsNoTracking" thông qua việc disable Identity Map.
   */
  async getPaged(
    request: PagedAndSortedRequest,
    filter: FilterQuery<T> = {},
    options: FindOptions<T, any> = {}
  ): Promise<PagedResult<T>> {
    const pageNumber = request.PageNumber || 1;
    const pageSize = request.PageSize || 10;

    // Mặc định lọc các bản ghi hoạt động (Soft Delete logic)
    const finalFilter = {
      isActive: true,
      ...(filter as any)
    } as FilterQuery<T>;

    // Xử lý logic NoTracking (tối ưu hiệu năng đọc)
    const findOptions: FindOptions<T, any> = {
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
      disableIdentityMap: request.IsDescending === true, // Tùy chọn, ở đây ta có thể dùng một flag riêng nếu cần
      ...options
    } as any;

    // Sắp xếp
    if (request.SortOrder) {
      findOptions.orderBy = {
        createdAt: request.SortOrder.toUpperCase()
      } as any;
    }

    const [items, totalCount] = await this.findAndCount(
      finalFilter,
      findOptions
    );
    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    return new PagedResult<T>({
      items,
      pageNumber,
      pageSize,
      totalCount,
      totalPages
    });
  }

  /** Kiểm tra sự tồn tại của bản ghi */
  async exists(filter: FilterQuery<T>): Promise<boolean> {
    const count = await this.count({
      isActive: true,
      ...(filter as any)
    } as FilterQuery<T>);
    return count > 0;
  }
}
