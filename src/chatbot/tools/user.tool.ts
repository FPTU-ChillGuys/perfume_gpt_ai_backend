import { Injectable, Logger } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { UserService } from 'src/infrastructure/domain/user/user.service';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import * as z from 'zod';

@Injectable()
export class UserTool {
  private readonly logger = new Logger(UserTool.name);

  constructor(private readonly userService: UserService) {}

  getUserById: Tool = tool({
    description:
      'Retrieve user information by user ID, including email, username, and phone number.',
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user'),
    }),
    execute: async (input) => {
      this.logger.log(`[getUserById] called for userId: ${input.userId}`);
      return await funcHandlerAsync(
        async () => {
          const response = await this.userService.getUserById(input.userId);
          this.logger.debug(`[getUserById] response received for userId: ${input.userId}`);
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
