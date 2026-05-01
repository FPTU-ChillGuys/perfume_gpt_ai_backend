import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { ProfileResponse } from 'src/application/dtos/response/profile.response';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly err: I18nErrorHandler
  ) {}

  async getOwnProfile(
    userId: string
  ): Promise<BaseResponseAPI<ProfileResponse>> {
    return this.err.wrap(
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
          return this.err.fail('errors.profile.not_found');
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
      'errors.profile.fetch'
    );
  }

  async createProfileReport(profileResponse?: ProfileResponse): Promise<string> {
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

  async searchProfile(query: string): Promise<BaseResponseAPI<any[]>> {
    return this.err.wrap(async () => {
      const users = await this.prisma.aspNetUsers.findMany({
        where: {
          OR: [
            { FullName: { contains: query } },
            { PhoneNumber: { contains: query } },
            { Email: { contains: query } },
            { UserName: { contains: query } }
          ],
          IsDeleted: false
        },
        select: {
          Id: true,
          FullName: true,
          PhoneNumber: true,
          Email: true,
          UserName: true
        },
        take: 5
      });

      const results = users.map((user) => ({
        userId: user.Id,
        fullName: user.FullName,
        phoneNumber: user.PhoneNumber,
        email: user.Email,
        userName: user.UserName
      }));

      return { success: true, payload: results };
    }, 'errors.profile.fetch');
  }
}