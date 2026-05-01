import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';

export interface UserEmailInfo {
  email: string;
  userName?: string;
}

export interface ActiveDailyRecommendationRecipient {
  id: string;
  email: string;
  userName: string;
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly err: I18nErrorHandler
  ) {}

  async getEmailById(userId: string): Promise<BaseResponseAPI<string>> {
    return await this.err.wrap(
      async () => {
        const user = await this.prisma.aspNetUsers.findUnique({
          where: { Id: userId },
          select: { Email: true }
        });
        return { success: true, payload: user?.Email ?? null };
      },
      'errors.user.fetch_email'
    );
  }

  async getUserEmailInfo(
    userId: string
  ): Promise<BaseResponseAPI<UserEmailInfo>> {
    return await this.err.wrap(
      async () => {
        const user = await this.prisma.aspNetUsers.findUnique({
          where: { Id: userId },
          select: { Email: true, UserName: true, FullName: true }
        });

        if (!user) {
          return { success: true, payload: null };
        }

        return {
          success: true,
          payload: {
            email: user.Email ?? '',
            userName: this.formatDisplayName(user.FullName, user.UserName)
          }
        };
      },
      'errors.user.fetch_email_info'
    );
  }

  async getAllUserIds(): Promise<BaseResponseAPI<string[]>> {
    return await this.err.wrap(
      async () => {
        const users = await this.prisma.aspNetUsers.findMany({
          select: { Id: true }
        });
        const userIds = users.map((user) => user.Id);
        return { success: true, payload: userIds };
      },
      'errors.user.fetch_all_ids'
    );
  }

  async getActiveUsersForDailyRecommendationEmail(): Promise<
    BaseResponseAPI<ActiveDailyRecommendationRecipient[]>
  > {
    return await this.err.wrap(
      async () => {
        const users = await this.prisma.aspNetUsers.findMany({
          where: {
            IsActive: true,
            IsDeleted: false,
            EmailConfirmed: true,
            Email: { not: null }
          },
          select: {
            Id: true,
            Email: true,
            UserName: true,
            FullName: true
          }
        });

        const recipients: ActiveDailyRecommendationRecipient[] = users
          .map((user) => ({
            id: user.Id,
            email: user.Email?.trim() ?? '',
            userName: this.formatDisplayName(user.FullName, user.UserName)
          }))
          .filter((user) => user.email.length > 0);

        return {
          success: true,
          payload: recipients
        };
      },
      'errors.user.fetch_active'
    );
  }

  async getUserById(userId: string): Promise<
    BaseResponseAPI<{
      id: string;
      email: string;
      userName: string;
      phoneNumber?: string;
    }>
  > {
    return await this.err.wrap(
      async () => {
        const user = await this.prisma.aspNetUsers.findUnique({
          where: { Id: userId },
          select: {
            Id: true,
            Email: true,
            UserName: true,
            FullName: true,
            PhoneNumber: true
          }
        });

        if (!user) {
          return this.err.fail('errors.user.not_found');
        }

        return {
          success: true,
          payload: {
            id: user.Id,
            email: user.Email ?? '',
            userName: this.formatDisplayName(user.FullName, user.UserName),
            phoneNumber: user.PhoneNumber ?? undefined
          }
        };
      },
      'errors.user.fetch_info'
    );
  }

  async isUserExistedByUserId(
    userId: string
  ): Promise<BaseResponseAPI<boolean>> {
    return await this.err.wrap(
      async () => {
        const user = await this.prisma.aspNetUsers.findUnique({
          where: { Id: userId },
          select: { Id: true }
        });
        return { success: true, payload: !!user };
      },
      'errors.user.check_existence'
    );
  }

  private formatDisplayName(fullName?: string | null, userName?: string | null): string {
    if (fullName && fullName.trim().length > 0) {
      return fullName.trim();
    }

    if (userName && userName.trim().length > 0) {
      const name = userName.trim();
      if (name.includes('@')) {
        return name.split('@')[0];
      }
      return name;
    }

    return 'Khách hàng';
  }
}
