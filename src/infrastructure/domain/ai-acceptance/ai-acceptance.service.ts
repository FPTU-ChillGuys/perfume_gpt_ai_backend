import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { AIAcceptance } from 'src/domain/entities/ai-acceptance.entities';
import { Injectable } from '@nestjs/common';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';

@Injectable()
export class AIAcceptanceService {
  constructor(private unitOfWork: UnitOfWork) {}

  async updateAIAcceptanceStatusById(
    id: string,
    cartItemId?: string | null,
    isAccepted: boolean = false,
  ): Promise<BaseResponse<AIAcceptance>> {
    const userAIAcceptance = await this.unitOfWork.AIAcceptanceRepo.findOne({
      id
    });

    if (userAIAcceptance) {
      const updateData: any = { isAccepted };
      if (cartItemId !== undefined) {
        updateData.cartItemId = cartItemId;
      }
      await this.unitOfWork.AIAcceptanceRepo.assign(
        userAIAcceptance,
        updateData
      );
      await this.unitOfWork.AIAcceptanceRepo.getEntityManager().flush();
    } else {
      return { success: false, error: 'AIAcceptance record not found' };
    }

    return {
      success: true,
      data: userAIAcceptance
    };
  }

  async updateAIAcceptanceByUserIdAndCartId(
    userId: string,
    cartItemId?: string | null,
    isAccepted: boolean = false
  ): Promise<BaseResponse<AIAcceptance>> {
    const userAIAcceptance = await this.unitOfWork.AIAcceptanceRepo.findOne({
      userId,
      cartItemId
    });

    if (userAIAcceptance) {
      const updateData: any = { isAccepted };
      if (cartItemId !== undefined) {
        updateData.cartItemId = cartItemId;
      }
      await this.unitOfWork.AIAcceptanceRepo.assign(
        userAIAcceptance,
        updateData
      );
      await this.unitOfWork.AIAcceptanceRepo.getEntityManager().flush();
    } else {
      return { success: false, error: 'AIAcceptance record not found' };
    }

    return {
      success: true,
      data: userAIAcceptance
    };
  }

  async createAIAcceptanceRecord(
    userId: string,
    isAccepted: boolean,
    cartItemId?: string | null
  ): Promise<BaseResponse<AIAcceptance>> {
    const newAIAcceptance = new AIAcceptance({
      userId,
      isAccepted,
      cartItemId
    });
    await this.unitOfWork.AIAcceptanceRepo.insert(newAIAcceptance);
    return { success: true, data: newAIAcceptance };
  }

  async getAIAcceptanceByUserId(
    userId: string
  ): Promise<BaseResponse<AIAcceptance[] | null>> {
    const aiAcceptance = await this.unitOfWork.AIAcceptanceRepo.find({
      userId
    });
    if (!aiAcceptance) {
      return { success: false, error: 'AIAcceptance record not found' };
    }
    return { success: true, data: aiAcceptance };
  }

  async getAllAIAcceptanceStatus(): Promise<
    BaseResponse<AIAcceptance[] | null>
  > {
    return await funcHandlerAsync(
      async () => {
        const aiAcceptance = await this.unitOfWork.AIAcceptanceRepo.findAll({
          orderBy: { updatedAt: 'DESC' }
        });
        if (!aiAcceptance) {
          return { success: false, error: 'AIAcceptance record not found' };
        }
        return { success: true, data: aiAcceptance };
      },
      'Failed to retrieve AI acceptance records',
      true
    );
  }

  async getAIAcceptanceRateByAcceptanceStatus(
    isAccepted: boolean
  ): Promise<BaseResponse<number>> {
    const totalCount = await this.unitOfWork.AIAcceptanceRepo.count();
    if (totalCount === 0) {
      return { success: true, data: 0 };
    }
    const acceptedCount = await this.unitOfWork.AIAcceptanceRepo.count({
      isAccepted: isAccepted
    });
    const acceptanceRate = (acceptedCount / totalCount) * 100;
    return { success: true, data: acceptanceRate };
  }

  async getAIAcceptanceRateByAcceptanceStatusWithUserId(
    userId: string
  ): Promise<BaseResponse<number>> {
    const aiAcceptance = await this.unitOfWork.AIAcceptanceRepo.find({
      userId
    });
    if (!aiAcceptance) {
      return { success: false, error: 'AIAcceptance record not found' };
    }

    const acceptedCount = aiAcceptance.filter(
      (a) => a.isAccepted === true
    ).length;
    const acceptanceRate = (acceptedCount / aiAcceptance.length) * 100;

    return { success: true, data: acceptanceRate };
  }
}
