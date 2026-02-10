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
  ): Promise<BaseResponseAPI<ProfileResponse>> {
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

  async createProfileReport(profileResponse?: ProfileResponse): Promise<string> {
    // Convert profileResponse to string for prompt
    const profileReport = `User Profile:
    - User ID: ${profileResponse?.userId}
    - Profile ID: ${profileResponse?.id}
    - Favorite Notes: ${profileResponse?.favoriteNotes || 'Not specified'}
    - Preferred Style: ${profileResponse?.preferredStyle || 'Not specified'}
    - Scent Preference: ${profileResponse?.scentPreference || 'Not specified'}
    - Budget Range: ${profileResponse?.minBudget || 'Not specified'} - ${profileResponse?.maxBudget || 'Not specified'}
    - Created At: ${profileResponse?.createdAt}
    - Updated At: ${profileResponse?.updatedAt || 'Not updated'}`;

    return profileReport;
  }

  async createSystemPromptFromProfile(
    profileResponse?: ProfileResponse
  ): Promise<string> {
    const profileReport = await this.createProfileReport(profileResponse);
    const systemPrompt = `Here is the user's profile information:\n\n${profileReport}\n\nUse this information to provide personalized perfume recommendations and advice.`;
    return systemPrompt;
  }
}
