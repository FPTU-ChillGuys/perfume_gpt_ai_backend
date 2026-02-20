import { Injectable } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { ProfileResponse } from 'src/application/dtos/response/profile.response';
import { ProfileService } from 'src/infrastructure/servicies/profile.service';
import { funcHandlerAsync } from 'src/infrastructure/utils/error-handler';
import * as z from 'zod';

@Injectable()
export class ProfileTool {
  constructor(private readonly profileService: ProfileService) {}

  getOwnProfile: Tool = tool({
    description:
      'Retrieve the profile information of the authenticated user, including preferences, budget range, and favorite notes.',
    inputSchema: z.object({
      authToken: z.string().describe('JWT authentication token')
    }),
    execute: async (input) => {
      return await funcHandlerAsync(
        async () => {
          const response = await this.profileService.getOwnProfile(input.authToken);
          console.log('ProfileTool - getOwnProfile response:', response.payload);
          if (!response.success) {
            return { success: false, error: 'Failed to fetch profile.' };
          }
          return { success: true, data: response.payload || {} };
        },
        'Error occurred while fetching profile.',
        true
      );
    }
  });

//   createProfileReport: Tool = tool({
//     description:
//       'Generate a formatted text report of user profile information including preferences, favorite notes, budget range, and dates.',
//     inputSchema: z.object({
//       userId: z.string().describe('The ID of the user'),
//       favoriteNotes: z.string().optional().describe('User favorite scent notes'),
//       preferredStyle: z
//         .string()
//         .optional()
//         .describe('User preferred perfume style'),
//       scentPreference: z.string().optional().describe('User scent preferences'),
//       minBudget: z.number().optional().describe('Minimum budget range'),
//       maxBudget: z.number().optional().describe('Maximum budget range')
//     }),
//     execute: async (input) => {
//       return await funcHandlerAsync(
//         async () => {
//           const profileData: Partial<ProfileResponse> = {
//             userId: input.userId,
//             id: input.userId,
//             favoriteNotes: input.favoriteNotes,
//             preferredStyle: input.preferredStyle,
//             scentPreference: input.scentPreference,
//             minBudget: input.minBudget,
//             maxBudget: input.maxBudget
//           };

//           const report = await this.profileService.createProfileReport(
//             profileData as ProfileResponse
//           );
//           console.log('ProfileTool - createProfileReport:', report);
//           return { success: true, data: report };
//         },
//         'Error occurred while creating profile report.',
//         true
//       );
//     }
//   });

//   createSystemPromptFromProfile: Tool = tool({
//     description:
//       'Generate a system prompt for the AI chatbot using user profile information. This helps personalize recommendations.',
//     inputSchema: z.object({
//       userId: z.string().describe('The ID of the user'),
//       favoriteNotes: z.string().optional().describe('User favorite scent notes'),
//       preferredStyle: z
//         .string()
//         .optional()
//         .describe('User preferred perfume style'),
//       scentPreference: z.string().optional().describe('User scent preferences'),
//       minBudget: z.number().optional().describe('Minimum budget range'),
//       maxBudget: z.number().optional().describe('Maximum budget range'),
//       authToken: z.string().describe('JWT authentication token')
//     }),
//     execute: async (input) => {
//       return await funcHandlerAsync(
//         async () => {
//           // First, try to get the actual profile from the service
//           let profileData: Partial<ProfileResponse> | undefined;
//           try {
//             const profileResponse = await this.profileService.getOwnProfile(
//               input.authToken
//             );
//             if (profileResponse.success) {
//               profileData = profileResponse.payload;
//             }
//           } catch (error) {
//             console.log('Could not fetch actual profile, using provided data');
//             profileData = {
//               userId: input.userId,
//               id: input.userId,
//               favoriteNotes: input.favoriteNotes,
//               preferredStyle: input.preferredStyle,
//               scentPreference: input.scentPreference,
//               minBudget: input.minBudget,
//               maxBudget: input.maxBudget
//             };
//           }

//           const systemPrompt = await this.profileService.createSystemPromptFromProfile(
//             profileData as ProfileResponse
//           );
//           console.log('ProfileTool - createSystemPromptFromProfile:', systemPrompt);
//           return { success: true, data: systemPrompt };
//         },
//         'Error occurred while creating system prompt from profile.',
//         true
//       );
//     }
//   });
}
