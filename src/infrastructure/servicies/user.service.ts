import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { funcHandlerAsync } from '../utils/error-handler';

export interface UserEmailInfo {
  email: string;
  userName?: string;
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getEmailById(userId: string): Promise<BaseResponseAPI<string>> {
    return await funcHandlerAsync(
      async () => {
        const user = await this.prisma.aspNetUsers.findUnique({
          where: { Id: userId },
          select: { Email: true }
        });
        return { success: true, payload: user?.Email ?? null };
      },
      'Failed to fetch user email',
      true
    );
  }

  /**
   * Lấy email và userName của user
   */
  async getUserEmailInfo(
    userId: string
  ): Promise<BaseResponseAPI<UserEmailInfo>> {
    return await funcHandlerAsync(
      async () => {
        const user = await this.prisma.aspNetUsers.findUnique({
          where: { Id: userId },
          select: { Email: true, UserName: true }
        });

        if (!user) {
          return { success: true, payload: null };
        }

        return {
          success: true,
          payload: {
            email: user.Email ?? '',
            userName: user.UserName ?? 'Khách hàng'
          }
        };
      },
      'Failed to fetch user email info',
      true
    );
  }

  //Lay tat ca userIds tu tat ca nguoi dung
  async getAllUserIds(): Promise<BaseResponseAPI<string[]>> {
    return await funcHandlerAsync(
      async () => {
        const users = await this.prisma.aspNetUsers.findMany({
          select: { Id: true }
        });
        const userIds = users.map((user) => user.Id);
        return { success: true, payload: userIds };
      },
      'Failed to fetch all user IDs',
      true
    );
  }

  /**
   * Lấy thông tin user theo userId
   */
  async getUserById(userId: string): Promise<
    BaseResponseAPI<{
      id: string;
      email: string;
      userName: string;
      phoneNumber?: string;
    }>
  > {
    return await funcHandlerAsync(
      async () => {
        const user = await this.prisma.aspNetUsers.findUnique({
          where: { Id: userId },
          select: {
            Id: true,
            Email: true,
            UserName: true,
            PhoneNumber: true
          }
        });

        if (!user) {
          return { success: false, error: `User with ID ${userId} not found` };
        }

        return {
          success: true,
          payload: {
            id: user.Id,
            email: user.Email ?? '',
            userName: user.UserName ?? 'Người dùng',
            phoneNumber: user.PhoneNumber ?? undefined
          }
        };
      },
      'Failed to fetch user information',
      true
    );
  }

  async isUserExistedByUserId(
    userId: string
  ): Promise<BaseResponseAPI<boolean>> {
    return await funcHandlerAsync(
      async () => {
        const user = await this.prisma.aspNetUsers.findUnique({
          where: { Id: userId },
          select: { Id: true }
        });
        return { success: true, payload: !!user };
      },
      'Failed to check user existence by ID',
      true
    );
  }
}
