import { Cache } from 'cache-manager';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import * as crypto from 'crypto';
import { add } from 'date-fns';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';

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

/**
 * Creates a background job or returns an existing running job if one exists.
 * @param cacheManager - The Cache execution context
 * @param jobFunction - The function to execute in the background
 * @param options - Configuration for the background job
 * @param request - Optional Request object
 * @returns Result containing the job ID and expiration time
 */
export async function createBackgroundJob<T>(
    cacheManager: Cache,
    jobFunction: () => Promise<BaseResponse<T>>,
    options: {
        type: string; // The type/category of the job, e.g., 'trend_job', 'inventory_report_job'
        cacheKeyFactory: (jobId: string) => string;
        ttlMilliseconds: number;
    },
    request?: Request
): Promise<BaseResponse<{ jobId: string; expirationTime?: Date }>> {
    const latestJobKey = `${options.type}_latest_job_id`;

    // Check if there is an existing valid job ID for this type
    const existingJobId = await cacheManager.get<string>(latestJobKey);
    if (existingJobId) {
        const existingJobCacheKey = options.cacheKeyFactory(existingJobId);
        const existingJobData = await cacheManager.get(existingJobCacheKey);

        // If the job data still exists, we reuse this job ID
        if (existingJobData) {
            const expirationTime = add(new Date(), { seconds: options.ttlMilliseconds / 1000 });
            return Ok({ jobId: existingJobId, expirationTime });
        }
    }

    // No existing job or it expired, create a new one
    const jobId = crypto.randomUUID();
    const cacheKey = options.cacheKeyFactory(jobId);

    // Save the new job ID as the latest for this type
    await cacheManager.set(latestJobKey, jobId, options.ttlMilliseconds);

    // Initialize job status
    await cacheManager.set(cacheKey, { status: 'pending' }, options.ttlMilliseconds);

    // Start background processing
    processBackgroundJob(
        cacheManager,
        jobFunction,
        { cacheKey, ttlMilliseconds: options.ttlMilliseconds },
        request
    );

    const expirationTime = add(new Date(), { seconds: options.ttlMilliseconds / 1000 });

    return Ok({ jobId, expirationTime });
}

/**
 * Checks the status and result of a background job.
 * @param cacheManager - The Cache execution context
 * @param cacheKey - The specific cache key for the job
 * @param errorDetails - Any additional metadata to log if the job is not found
 * @returns The cache data for the job
 */
export async function checkBackgroundJobResult(
    cacheManager: Cache,
    cacheKey: string,
    errorDetails: Record<string, any>
): Promise<BaseResponse<any>> {
    const jobData = await cacheManager.get(cacheKey);

    if (!jobData) {
        throw new InternalServerErrorWithDetailsException('Job not found or expired', errorDetails);
    }

    return Ok(jobData);
}
