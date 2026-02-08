import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { UnitOfWork } from '../repositories/unit-of-work';
import { AIAcceptance } from 'src/domain/entities/ai-acceptance.entities';

export class AIAcceptanceService {
  constructor(private unitOfWork: UnitOfWork) {}

  async updateAIAcceptanceStatusById(
    id: string,
    isAccepted: boolean
  ): Promise<BaseResponse<AIAcceptance>> {
    const userAIAcceptance = await this.unitOfWork.AIAcceptanceRepo.findOne({
      id
    });

    if (userAIAcceptance) {
      userAIAcceptance.isAccepted = isAccepted;
      await this.unitOfWork.AIAcceptanceRepo.assign(userAIAcceptance, {
        isAccepted
      });
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
    isAccepted: boolean
  ): Promise<BaseResponse<AIAcceptance>> {
    const newAIAcceptance = new AIAcceptance({ userId, isAccepted });
    await this.unitOfWork.AIAcceptanceRepo.insert(newAIAcceptance);
    return { success: true, data: newAIAcceptance };
  }

  async getAIAcceptanceByUserId(
    userId: string
  ): Promise<BaseResponse<AIAcceptance | null>> {
    const aiAcceptance = await this.unitOfWork.AIAcceptanceRepo.findOne({
      userId
    });
    if (!aiAcceptance) {
      return { success: false, error: 'AIAcceptance record not found' };
    }
    return { success: true, data: aiAcceptance };
  }

  async getAIAcceptanceRateByAcceptanceStatus(
    isAccepted: boolean
  ): Promise<BaseResponse<number>> {
    const totalCount = await this.unitOfWork.AIAcceptanceRepo.count();
    if (totalCount === 0) {
      return { success: true, data: 0 };
    }
    const acceptedCount = await this.unitOfWork.AIAcceptanceRepo.count({
      isAccepted
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

    const acceptedCount = aiAcceptance.filter((a) => a.isAccepted).length;
    const acceptanceRate = (acceptedCount / aiAcceptance.length) * 100;

    return { success: true, data: acceptanceRate };
  }
}
