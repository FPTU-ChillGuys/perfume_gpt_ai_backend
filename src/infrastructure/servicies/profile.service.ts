import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { ProfileResponse } from 'src/application/dtos/response/profile.response';
import { funcHandlerAsync } from '../utils/error-handler';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnProfile(
    userId: string
  ): Promise<BaseResponseAPI<ProfileResponse>> {
    return await funcHandlerAsync(
      async () => {
        const profile = await this.prisma.customerProfiles.findUnique({
          where: { UserId: userId },
        });
        if (!profile) {
          return { success: false, error: 'Profile not found' };
        }
        const response = new ProfileResponse({
          id: profile.Id,
          userId: profile.UserId,
          scentPreference: profile.ScentPreference ?? null,
          minBudget: profile.MinBudget ? Number(profile.MinBudget) : null,
          maxBudget: profile.MaxBudget ? Number(profile.MaxBudget) : null,
          preferredStyle: profile.PreferredStyle ?? null,
          favoriteNotes: profile.FavoriteNotes ?? null,
          createdAt: profile.CreatedAt.toISOString(),
          updatedAt: profile.UpdatedAt ? profile.UpdatedAt.toISOString() : null,
        });
        return { success: true, payload: response };
      },
      'Failed to fetch profile'
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

