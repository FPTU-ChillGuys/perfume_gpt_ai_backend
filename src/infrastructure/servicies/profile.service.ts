import { HttpService } from '@nestjs/axios';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { ProfileResponse } from 'src/application/dtos/response/profile.response';
import { funcHandlerAsync } from '../utils/error-handler';
import ApiUrl from '../api/api_url';
import { firstValueFrom } from 'rxjs';

export class ProfileService {
  constructor(private readonly httpService: HttpService) {}

  async getOwnProfile(
    authHeader: string
  ): Promise<BaseResponseAPI<PagedResult<ProfileResponse>>> {
    return await funcHandlerAsync(
      async () => {
        console.log(ApiUrl().PROFILE_URL('me'));
        const { data } = await firstValueFrom(
          this.httpService.get<BaseResponseAPI<ProfileResponse>>(
            ApiUrl().PROFILE_URL('me'),
            {
              headers: {
                Authorization: `Bearer ${authHeader}`
              }
            }
          )
        );
        return data;
      },
      'Failed to fetch profile',
      true
    );
  }
}
