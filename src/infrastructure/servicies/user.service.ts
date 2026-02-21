import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { funcHandlerAsync } from '../utils/error-handler';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getEmailById(userId: string): Promise<BaseResponseAPI<string>> {
    return await funcHandlerAsync(
      async () => {
        const user = await this.prisma.aspNetUsers.findUnique({
          where: { Id: userId },
          select: { Email: true },
        });
        return { success: true, payload: user?.Email ?? null };
      },
      'Failed to fetch user email',
      true
    );
  }
}

