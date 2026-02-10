/**
 * Bộ nhớ đệm đơn giản trong bộ nhớ (in-memory) với TTL (time-to-live).
 * Dùng để cache kết quả AI tốn thời gian (summary, recommendation, report).
 *
 * @example
 * ```ts
 * const cache = new SimpleMemoryCache<string>(5 * 60 * 1000); // TTL = 5 phút
 * cache.set('user:123:summary', 'AI summary text');
 * const cached = cache.get('user:123:summary'); // 'AI summary text' hoặc undefined
 * ```
 */
export class SimpleMemoryCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();

  /**
   * @param ttlMs - Thời gian sống của mỗi entry (mili giây). Mặc định 5 phút.
   */
  constructor(private readonly ttlMs: number = 5 * 60 * 1000) {}

  /** Lấy giá trị từ cache. Trả về undefined nếu hết hạn hoặc không tồn tại. */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /** Lưu giá trị vào cache với TTL. */
  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
  }

  /** Kiểm tra entry có tồn tại và còn hạn không. */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /** Xóa entry theo key. */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /** Xóa tất cả entry đã hết hạn. */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /** Xóa toàn bộ cache. */
  clear(): void {
    this.cache.clear();
  }

  /** Số lượng entry hiện có (kể cả hết hạn). */
  get size(): number {
    return this.cache.size;
  }
}
