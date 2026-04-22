import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public, Role } from 'src/application/common/Metadata';
import { ReviewService } from 'src/infrastructure/domain/review/review.service';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { ApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import { ReviewLog } from 'src/domain/entities/review-log.entity';

@ApiBearerAuth('jwt')
@Role(['admin'])
@ApiTags('Reviews')
@Controller('reviews')
export class ReviewController {

    constructor(
        private readonly reviewService: ReviewService,
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
