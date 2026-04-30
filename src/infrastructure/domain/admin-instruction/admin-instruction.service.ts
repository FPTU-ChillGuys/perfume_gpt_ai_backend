import { Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { AdminInstruction } from 'src/domain/entities/admin-instruction.entity';
import { AdminInstructionResponse } from 'src/application/dtos/response/admin-instruction/admin-instruction.response';
import {
  CreateAdminInstructionRequest
} from 'src/application/dtos/request/admin-instruction/create-admin-instruction.request';
import {
  UpdateAdminInstructionRequest
} from 'src/application/dtos/request/admin-instruction/update-admin-instruction.request';

/** Service quản lý chỉ thị admin cho hệ thống AI */
@Injectable()
export class AdminInstructionService {
  private readonly logger = new Logger(AdminInstructionService.name);
  constructor(private unitOfWork: UnitOfWork) {}

  /** Lấy tất cả chỉ thị */
  async getAllInstructions(): Promise<BaseResponse<AdminInstructionResponse[]>> {
    return await funcHandlerAsync(
      async () => {
        const instructions = await this.unitOfWork.AdminInstructionRepo.findAll({ orderBy: { updatedAt: 'DESC' } });
        const response = instructions.map(i => AdminInstructionResponse.fromEntity(i)!);
        return { success: true, data: response };
      },
      'Failed to get all admin instructions',
      true
    );
  }

  /** Lấy chỉ thị theo ID */
  async getInstructionById(id: string): Promise<BaseResponse<AdminInstructionResponse>> {
    return await funcHandlerAsync(
      async () => {
        const instruction = await this.unitOfWork.AdminInstructionRepo.findOne({ id });
        if (!instruction) {
          return { success: false, error: 'Admin instruction not found' };
        }
        return { success: true, data: AdminInstructionResponse.fromEntity(instruction)! };
      },
      'Failed to get admin instruction',
      true
    );
  }

  /** Lấy chỉ thị theo loại */
  async getInstructionsByType(type: string): Promise<BaseResponse<AdminInstructionResponse[]>> {
    return await funcHandlerAsync(
      async () => {
        const instructions = await this.unitOfWork.AdminInstructionRepo.findByType(type);
        const response = instructions.map(i => AdminInstructionResponse.fromEntity(i)!);
        return { success: true, data: response };
      },
      'Failed to get admin instructions by type',
      true
    );
  }

  /** Gộp tất cả chỉ thị theo loại thành chuỗi prompt dùng cho AI */
  async getCombinedPromptByType(type: string): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(
      async () => {
        const combined = await this.unitOfWork.AdminInstructionRepo.getCombinedInstructionsByType(type);
        return { success: true, data: combined };
      },
      'Failed to get combined instructions',
      true
    );
  }

  /** Tạo chỉ thị mới */
  async createInstruction(
    request: CreateAdminInstructionRequest
  ): Promise<BaseResponse<AdminInstructionResponse>> {
    return await funcHandlerAsync(
      async () => {
        const instruction = new AdminInstruction(request.toEntity());

        this.unitOfWork.AdminInstructionRepo.add(instruction);
        await this.unitOfWork.AdminInstructionRepo.flush();

        return { success: true, data: AdminInstructionResponse.fromEntity(instruction)! };
      },
      'Failed to create admin instruction',
      true
    );
  }

  /** Cập nhật chỉ thị */
  async updateInstruction(
    id: string,
    request: UpdateAdminInstructionRequest
  ): Promise<BaseResponse<AdminInstructionResponse>> {
    return await funcHandlerAsync(
      async () => {
        const instruction = await this.unitOfWork.AdminInstructionRepo.findOne({ id });
        if (!instruction) {
          return { success: false, error: 'Admin instruction not found' };
        }

        if (request.instruction !== undefined) {
          instruction.instruction = request.instruction;
        }
        if (request.instructionType !== undefined) {
          instruction.instructionType = request.instructionType;
        }

        await this.unitOfWork.AdminInstructionRepo.flush();

        return { success: true, data: AdminInstructionResponse.fromEntity(instruction)! };
      },
      'Failed to update admin instruction',
      true
    );
  }

  /** Xóa chỉ thị */
  async deleteInstruction(id: string): Promise<BaseResponse<boolean>> {
    return await funcHandlerAsync(
      async () => {
        const instruction = await this.unitOfWork.AdminInstructionRepo.findOne({ id });
        if (!instruction) {
          return { success: false, error: 'Admin instruction not found' };
        }

        this.unitOfWork.AdminInstructionRepo.remove(instruction);
        await this.unitOfWork.AdminInstructionRepo.flush();

        return { success: true, data: true };
      },
      'Failed to delete admin instruction',
      true
    );
  }

  /**
   * Lấy system prompt cho một domain cụ thể (review, order, inventory, trend, recommendation, log, conversation).
   * Trả về chuỗi rỗng nếu không có instruction nào cho domain đó.
   * Dùng để inject admin instruction vào các AI endpoint.
   */
  async getSystemPromptForDomain(domain: string): Promise<string> {
    try {
      const combined = await this.unitOfWork.AdminInstructionRepo.getCombinedInstructionsByType(domain);
      return combined || '';
    } catch (error) {
      this.logger.error(`Failed to get system prompt for domain "${domain}"`, error);
      return '';
    }
  }
}
