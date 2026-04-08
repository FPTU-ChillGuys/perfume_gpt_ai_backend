import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { ProfileResponse } from 'src/application/dtos/response/profile.response';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';

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
          include: {
            CustomerFamilyPreferences: {
              include: {
                OlfactoryFamilies: true
              }
            },
            CustomerNotePreferences: {
              include: {
                ScentNotes: true
              }
            },
            CustomerAttributePreferences: {
              include: {
                AttributeValues: true
              }
            }
          }
        });
        if (!profile) {
          return { success: false, error: 'Profile not found' };
        }

        const scentPreference =
          profile.CustomerFamilyPreferences.length > 0
            ? profile.CustomerFamilyPreferences
                .map((item) => item.OlfactoryFamilies.Name)
                .filter(Boolean)
                .join(', ')
            : null;

        const favoriteNotes =
          profile.CustomerNotePreferences.length > 0
            ? profile.CustomerNotePreferences
                .map((item) => item.ScentNotes.Name)
                .filter(Boolean)
                .join(', ')
            : null;

        const preferredStyle =
          profile.CustomerAttributePreferences.length > 0
            ? profile.CustomerAttributePreferences
                .map((item) => item.AttributeValues.Value)
                .filter(Boolean)
                .join(', ')
            : null;

        const response = new ProfileResponse({
          id: profile.Id,
          userId: profile.UserId,
          dateOfBirth: profile.DateOfBirth
            ? profile.DateOfBirth.toISOString()
            : null,
          scentPreference,
          minBudget: profile.MinBudget ? Number(profile.MinBudget) : null,
          maxBudget: profile.MaxBudget ? Number(profile.MaxBudget) : null,
          preferredStyle,
          favoriteNotes,
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

