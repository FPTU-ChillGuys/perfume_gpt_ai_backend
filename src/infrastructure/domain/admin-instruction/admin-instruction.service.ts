import { Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { AdminInstruction } from 'src/domain/entities/admin-instruction.entity';
import { AdminInstructionResponse } from 'src/application/dtos/response/admin-instruction/admin-instruction.response';
import {
  CreateAdminInstructionRequest
} from 'src/application/dtos/request/admin-instruction/create-admin-instruction.request';
import {
  UpdateAdminInstructionRequest
} from 'src/application/dtos/request/admin-instruction/update-admin-instruction.request';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';

@Injectable()
export class AdminInstructionService {
  private readonly logger = new Logger(AdminInstructionService.name);
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly err: I18nErrorHandler
  ) {}

  async getAllInstructions(): Promise<BaseResponse<AdminInstructionResponse[]>> {
    return this.err.wrap(
      async () => {
        const instructions = await this.unitOfWork.AdminInstructionRepo.findAll({ orderBy: { updatedAt: 'DESC' } });
        const response = instructions.map(i => AdminInstructionResponse.fromEntity(i)!);
        return { success: true, data: response };
      },
      'errors.admin_instruction.get_all'
    );
  }

  async getInstructionById(id: string): Promise<BaseResponse<AdminInstructionResponse>> {
    return this.err.wrap(
      async () => {
        const instruction = await this.unitOfWork.AdminInstructionRepo.findOne({ id });
        if (!instruction) {
          return this.err.fail('errors.admin_instruction.not_found');
        }
        return { success: true, data: AdminInstructionResponse.fromEntity(instruction)! };
      },
      'errors.admin_instruction.get_by_id'
    );
  }

  async getInstructionsByType(type: string): Promise<BaseResponse<AdminInstructionResponse[]>> {
    return this.err.wrap(
      async () => {
        const instructions = await this.unitOfWork.AdminInstructionRepo.findByType(type);
        const response = instructions.map(i => AdminInstructionResponse.fromEntity(i)!);
        return { success: true, data: response };
      },
      'errors.admin_instruction.get_by_type'
    );
  }

  async getCombinedPromptByType(type: string): Promise<BaseResponse<string>> {
    return this.err.wrap(
      async () => {
        const combined = await this.unitOfWork.AdminInstructionRepo.getCombinedInstructionsByType(type);
        return { success: true, data: combined };
      },
      'errors.admin_instruction.combined'
    );
  }

  async createInstruction(
    request: CreateAdminInstructionRequest
  ): Promise<BaseResponse<AdminInstructionResponse>> {
    return this.err.wrap(
      async () => {
        const instruction = new AdminInstruction(request.toEntity());

        this.unitOfWork.AdminInstructionRepo.add(instruction);
        await this.unitOfWork.AdminInstructionRepo.flush();

        return { success: true, data: AdminInstructionResponse.fromEntity(instruction)! };
      },
      'errors.admin_instruction.create'
    );
  }

  async updateInstruction(
    id: string,
    request: UpdateAdminInstructionRequest
  ): Promise<BaseResponse<AdminInstructionResponse>> {
    return this.err.wrap(
      async () => {
        const instruction = await this.unitOfWork.AdminInstructionRepo.findOne({ id });
        if (!instruction) {
          return this.err.fail('errors.admin_instruction.not_found');
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
      'errors.admin_instruction.update'
    );
  }

  async deleteInstruction(id: string): Promise<BaseResponse<boolean>> {
    return this.err.wrap(
      async () => {
        const instruction = await this.unitOfWork.AdminInstructionRepo.findOne({ id });
        if (!instruction) {
          return this.err.fail('errors.admin_instruction.not_found');
        }

        this.unitOfWork.AdminInstructionRepo.remove(instruction);
        await this.unitOfWork.AdminInstructionRepo.flush();

        return { success: true, data: true };
      },
      'errors.admin_instruction.delete'
    );
  }

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