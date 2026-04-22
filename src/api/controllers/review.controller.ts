import { Body, Controller, Get, Inject, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { createBackgroundJob, checkBackgroundJobResult } from 'src/api/controllers/helper/background-job.helper';
import { Public, Role } from 'src/application/common/Metadata';
import { GetPagedReviewRequest } from 'src/application/dtos/request/get-paged-review.request';
import { ReviewListItemResponse } from 'src/application/dtos/response/review.response';
import { ReviewService } from 'src/infrastructure/domain/review/review.service';
import { ReviewAIService } from 'src/infrastructure/domain/review/review-ai.service';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { ApiBaseResponse, ExtendApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import { AIReviewSummaryStructuredResponse } from 'src/application/dtos/response/ai-structured.response';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';
import { ReviewLog } from 'src/domain/entities/review-log.entity';
import { ReviewTypeEnum } from 'src/domain/enum/review-log-type.enum';
import { CACHE_TTL_1MONTH } from 'src/infrastructure/domain/common/cacheable/cacheable.constants';

@ApiBearerAuth('jwt')
@Role(['admin'])
@ApiTags('Reviews')
@Controller('reviews')
export class ReviewController {

    constructor(
        private readonly reviewService: ReviewService,
        private readonly reviewAIService: ReviewAIService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }


    /** Lấy review log mới nhất theo variant ID */
    @Public()
    @Get('logs/latest/variant/:variantId')
    @ApiBaseResponse(ReviewLog)
    @ApiOperation({ summary: 'Lấy review log mới nhất theo variant ID' })
    @ApiParam({ name: 'variantId', description: 'ID của variant sản phẩm' })
    async getLatestReviewLogByVariantId(@Param('variantId') variantId: string): Promise<BaseResponseAPI<ReviewLog | null>> {
        return await this.reviewService.getLatestReviewLogByVariantId(variantId);
    }

}
