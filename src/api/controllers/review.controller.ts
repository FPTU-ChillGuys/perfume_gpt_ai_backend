import { Controller, Get, Query } from '@nestjs/common';
import { GetPagedReviewRequest } from 'src/application/dtos/request/get-paged-review.request';
import { ReviewService } from 'src/infrastructure/servicies/review.service';

@Controller('reviews')
export class ReviewController {

    constructor(
        private readonly reviewService: ReviewService
    ) {}

    //Get reviews
    @Get()
    async getReviews(@Query() request: GetPagedReviewRequest): Promise<any> {
        return await this.reviewService.getAllReviews(request);
    }

    //Review summary
    
}
