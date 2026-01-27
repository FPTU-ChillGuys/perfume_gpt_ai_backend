import { AddPromptRequest } from 'src/application/dtos/request/add-prompt.request';
import { UnitOfWork } from '../repositories/unit-of-work';
import { Injectable } from '@nestjs/common';
import { InjectMapper } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';
import { AIRequestResponse } from 'src/domain/entities/ai-request-response.entity';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { funcHandlerAsync } from '../utils/error-handler';

@Injectable()
export class PromptService {
  constructor(
    private unitOfWork: UnitOfWork,
    @InjectMapper() private mapper: Mapper
  ) {}

  async savePrompt(
    addPromptRequest: AddPromptRequest
  ): Promise<BaseResponse<AIRequestResponse>> {
    return await funcHandlerAsync(async () => {
      const aiRequestResponse = new AIRequestResponse({
        prompt: addPromptRequest.prompt,
        requestType: addPromptRequest.requestType,
        response: ''
      });
      await this.unitOfWork.AIRequestResponseRepo.insert(aiRequestResponse);
      return { success: true, data: aiRequestResponse };
    }, 'Failed to save prompt');
  }

  async updateResponse(id: string, response: string): Promise<BaseResponse> {
    return await funcHandlerAsync(async () => {
      const aiRequestResponse =
        await this.unitOfWork.AIRequestResponseRepo.findOne({ id });

      if (!aiRequestResponse) {
        return { success: false, error: 'Request not found' };
      }

      this.unitOfWork.AIRequestResponseRepo.assign(aiRequestResponse, {
        response: response
      });
      return { success: true };
    }, 'Failed to update response');
  }

  async getAllReqRes(): Promise<BaseResponse<AIRequestResponse[]>> {
    return await funcHandlerAsync(async () => {
      return {
        success: true,
        data: await this.unitOfWork.AIRequestResponseRepo.findAll()
      };
    }, 'Failed to get all request-responses');
  }

  async getReqResById(id: string): Promise<BaseResponse<AIRequestResponse>> {
    return await funcHandlerAsync(async () => {
      const aiRequestResponse =
        await this.unitOfWork.AIRequestResponseRepo.findOne({ id });
      if (!aiRequestResponse) {
        return { success: false, error: 'Request-Response not found' };
      }
      return { success: true, data: aiRequestResponse };
    }, 'Failed to get request-response by id');
  }
}
