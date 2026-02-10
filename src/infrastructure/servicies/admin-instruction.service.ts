import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../repositories/unit-of-work';
import { funcHandlerAsync } from '../utils/error-handler';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { AdminInstruction } from 'src/domain/entities/admin-instruction.entity';
import { AdminInstructionResponse } from 'src/application/dtos/response/admin-instruction.response';
import {
  CreateAdminInstructionRequest,
  UpdateAdminInstructionRequest
} from 'src/application/dtos/request/admin-instruction.request';

/** Service quản lý chỉ thị admin cho hệ thống AI */
@Injectable()
export class AdminInstructionService {
  constructor(private unitOfWork: UnitOfWork) {}

  /** Lấy tất cả chỉ thị */
  async getAllInstructions(): Promise<BaseResponse<AdminInstructionResponse[]>> {
    return await funcHandlerAsync(
      async () => {
        const instructions = await this.unitOfWork.AdminInstructionRepo.findAll();
        const response = instructions.map((i) => this.toResponse(i));
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
        return { success: true, data: this.toResponse(instruction) };
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
        const response = instructions.map((i) => this.toResponse(i));
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
        const instruction = new AdminInstruction({
          instruction: request.instruction,
          instructionType: request.instructionType
        });

        const em = this.unitOfWork.AdminInstructionRepo.getEntityManager();
        em.persist(instruction);
        await em.flush();

        return { success: true, data: this.toResponse(instruction) };
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

        const em = this.unitOfWork.AdminInstructionRepo.getEntityManager();
        await em.flush();

        return { success: true, data: this.toResponse(instruction) };
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

        const em = this.unitOfWork.AdminInstructionRepo.getEntityManager();
        em.remove(instruction);
        await em.flush();

        return { success: true, data: true };
      },
      'Failed to delete admin instruction',
      true
    );
  }

  /** Convert entity → response DTO */
  private toResponse(entity: AdminInstruction): AdminInstructionResponse {
    return new AdminInstructionResponse({
      id: entity.id,
      instruction: entity.instruction,
      instructionType: entity.instructionType,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    });
  }
}
