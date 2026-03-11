import { Injectable } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { UserService } from 'src/infrastructure/servicies/user.service';
import { funcHandlerAsync } from 'src/infrastructure/utils/error-handler';
import * as z from 'zod';

@Injectable()
export class UserTool {
  constructor(private readonly userService: UserService) {}

  getUserById: Tool = tool({
    description:
      'Retrieve user information by user ID, including email, username, and phone number.',
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user'),
    }),
    execute: async (input) => {
      return await funcHandlerAsync(
        async () => {
          const response = await this.userService.getUserById(input.userId);
          console.log('UserTool - getUserById response:', response.payload);
          if (!response.success) {
            return { success: false, error: response.error || 'Failed to fetch user information.' };
          }
          return { success: true, data: response.payload || {} };
        },
        'Error occurred while fetching user information.',
        true
      );
    }
  });
}
