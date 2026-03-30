import { Inject, Logger, Module, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { setCacheInstance, setLoggerInstance } from './cacheable.decorator';

/**
 * CacheableModule — module NestJS dùng để khởi tạo @Cacheable decorator.
 */
@Module({
    exports: [],
})
export class CacheableModule implements OnModuleInit {
    private readonly logger = new Logger(CacheableModule.name);

    constructor(
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
    ) { }

    onModuleInit() {
        setCacheInstance(this.cacheManager);
        setLoggerInstance(this.logger);
        this.logger.log('CacheableModule initialized — @Cacheable decorator is ready.');
    }
}
