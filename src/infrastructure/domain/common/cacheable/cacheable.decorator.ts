import { Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CACHE_TTL_1HOUR } from './cacheable.constants';

/**
 * Biến module-level để lưu trữ cache instance và logger.
 * Được thiết lập bởi CacheableModule trong constructor.
 */
let cacheInstance: Cache;
let loggerInstance: Logger;

/**
 * Thiết lập cache instance dùng cho @Cacheable decorator.
 * Hàm này được gọi nội bộ bởi CacheableModule.
 */
export function setCacheInstance(cache: Cache): void {
  cacheInstance = cache;
}

/**
 * Thiết lập logger instance dùng cho @Cacheable decorator.
 * Hàm này được gọi nội bộ bởi CacheableModule.
 */
export function setLoggerInstance(logger: Logger): void {
  loggerInstance = logger;
}

/**
 * Decorator @Cacheable - tự động cache kết quả của method.
 *
 * Cách hoạt động:
 * 1. Tạo cache key theo pattern: `ClassName:methodName:<keyGenerator(args)>`
 * 2. Kiểm tra cache — nếu có thì trả về ngay
 * 3. Nếu chưa có, chạy method gốc và lưu kết quả vào cache
 * 4. Nếu có lỗi liên quan tới cache, fallback về method gốc (không throw)
 *
 * @param keyGenerator Hàm tạo cache key từ tham số của method.
 *   Mặc định: join tất cả args bằng dấu '_'
 * @param ttl Thời gian sống của cache (giây). Mặc định: 1 giờ (3600s)
 *
 * @example
 * // Dùng mặc định - key = "ClassName:method:arg1_arg2"
 * @Cacheable()
 * async getProductById(id: string) { ... }
 *
 * @example
 * // Tùy chỉnh key và TTL
 * @Cacheable((args) => `product_${args[0]}`, CACHE_TTL_30MIN)
 * async getProductById(id: string) { ... }
 */
export const Cacheable = (
  keyGenerator: (args: any[]) => string = (args) =>
    args
      .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join('_'),
  ttl: number = CACHE_TTL_1HOUR
) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = propertyKey;

    descriptor.value = async function (...args: any[]) {
      // Nếu chưa khởi tạo (module chưa được import), chạy method gốc
      if (!cacheInstance) {
        return originalMethod.apply(this, args);
      }

      const cacheKey = `${className}:${methodName}:${keyGenerator(args)}`;

      try {
        const cachedData = await cacheInstance.get(cacheKey);

        if (cachedData !== null && cachedData !== undefined) {
          loggerInstance?.debug(
            `[Cache HIT] key="${cacheKey}"`,
            'CacheableDecorator'
          );
          return cachedData;
        }

        const result = await originalMethod.apply(this, args);

        await cacheInstance.set(cacheKey, result, ttl * 1000); // cache-manager v5 dùng ms
        loggerInstance?.debug(
          `[Cache SET] key="${cacheKey}", ttl=${ttl}s`,
          'CacheableDecorator'
        );

        return result;
      } catch (error) {
        loggerInstance?.error(
          `[Cache ERROR] key="${cacheKey}" - ${(error as Error)?.message}`,
          (error as Error)?.stack,
          'CacheableDecorator'
        );
        // Fallback: trả về kết quả gốc, không crash
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
};
