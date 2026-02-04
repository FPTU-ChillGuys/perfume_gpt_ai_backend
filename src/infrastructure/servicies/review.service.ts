import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { UnitOfWork } from '../repositories/unit-of-work';
import { ReviewListItemResponse } from 'src/application/dtos/response/review.response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { funcHandlerAsync } from '../utils/error-handler';
import ApiUrl from '../api/api_url';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

export class ReviewService {
  constructor(
    private unitOfWork: UnitOfWork,
    private readonly httpService: HttpService
  ) {}

  async getAllReviews(
    request: PagedAndSortedRequest
  ): Promise<BaseResponseAPI<ReviewListItemResponse>> {
    return await funcHandlerAsync(
      async () => {
        console.log(ApiUrl().PRODUCT_URL(''));
        const { data } = await firstValueFrom(
          this.httpService.get<BaseResponseAPI<ReviewListItemResponse>>(
            ApiUrl().REVIEW_URL(''),
            {
              params: {
                pageNumber: request.PageNumber ?? 1,
                pageSize: request.PageSize ?? 10,
                sortBy: request.SortBy ?? '',
                sortOrder: request.SortOrder ?? 'asc',
                isDescending: request.IsDescending ?? false
              }
            }
          )
        );
        return data;
      },
      'Failed to fetch reviews',
      true
    );
  }
}
