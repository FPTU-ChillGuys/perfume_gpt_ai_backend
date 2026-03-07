import { Cache } from 'cache-manager';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';

export interface BackgroundJobOptions {
    /** The cache key to store the job status and result */
    cacheKey: string;
    /** TTL for the initial pending status, and for the final result in milliseconds. Default is 1 day */
    ttlMilliseconds?: number;
}

export interface JobResultData<T> {
    status: 'pending' | 'completed' | 'failed';
    data?: T;
    error?: string;
    processingTimeMs?: number;
}

/**
 * Handles executing a background job and updating the cache with the 
 * successful or failed result once completed. It also records the execution time.
 * @param cacheManager - The NestJS Cache execution context
 * @param jobFunction - A callback function that returns the actual result (BaseResponse)
 * @param options - Configure the cache key and TTL
 */
export async function processBackgroundJob<T>(
    cacheManager: Cache,
    jobFunction: () => Promise<BaseResponse<T>>,
    options: BackgroundJobOptions,
    request?: Request
): Promise<void> {
    const { cacheKey, ttlMilliseconds = 60 * 60 * 24 * 1000 } = options;

    try {
        const startTime = Date.now();

        // Execute the background logic
        const result = await jobFunction();

        // Calculate how long it took
        const processingTimeMs = Date.now() - startTime;

        // Resetting the cache expiration with new job result and elapsed time
        if (result.success) {
            await cacheManager.set(
                cacheKey,
                {
                    status: 'completed',
                    data: result.data,
                    processingTimeMs
                } as JobResultData<T>,
                ttlMilliseconds
            );
        } else {
            await cacheManager.set(
                cacheKey,
                {
                    status: 'failed',
                    error: result.error?.toString() || 'Unknown error from background job',
                    processingTimeMs
                } as JobResultData<T>,
                ttlMilliseconds
            );
        }

        if (request) {
            const cachedData = await cacheManager.get(
                request.url
            );
            console.log(cachedData);
            await cacheManager.set(
                request.url,
                cachedData,
                ttlMilliseconds
            );
        }

    } catch (error) {
        console.error(`[BackgroundJob] Error running job for key ${options.cacheKey}:`, error);
        await cacheManager.set(
            options.cacheKey,
            {
                status: 'failed',
                error: error instanceof Error ? error.message : 'Internal Server Error'
            } as JobResultData<T>,
            ttlMilliseconds
        );
    }
}
