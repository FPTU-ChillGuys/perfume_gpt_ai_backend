import { UnitOfWork } from '../repositories/unit-of-work';
import { Injectable } from '@nestjs/common';
import { InjectMapper } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { funcHandlerAsync } from '../utils/error-handler';
import { UserLog } from 'src/domain/entities/user-log.entity';
import { UserSearchLogMapper } from 'src/application/mapping';
import { UserSearchLog } from 'src/domain/entities/user-search.log.entity';
import { UserSearchLogResponse } from 'src/application/dtos/response/user-search-log.response';

@Injectable()
export class UserLogService {
  constructor(
    private unitOfWork: UnitOfWork,
    @InjectMapper() private mapper: Mapper
  ) {}

  async getUserLogByUserId(userId: string): Promise<UserLog | null> {
    return this.unitOfWork.UserLogRepo.findOne({ userId });
  }

  async createUserLogIfNotExist(userId: string): Promise<UserLog> {
    let existingLog = await this.unitOfWork.UserLogRepo.findOne({ userId });
    if (!existingLog) {
      existingLog = await this.unitOfWork.UserLogRepo.createUserLog(userId);
    }
    return existingLog;
  }

  async addUserSearch(
    searchText: string,
    userId: string
  ): Promise<BaseResponse<UserSearchLogResponse[]>> {
    return await funcHandlerAsync(async () => {
      const searchLog = await this.unitOfWork.UserLogRepo.addSearchLogToUserLog(
        userId,
        searchText
      );
      const searchLogResponse = UserSearchLogMapper.toResponseList(searchLog);
      return { success: true, data: searchLogResponse };
    }, 'Failed to add user search log');
  }
}
