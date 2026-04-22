import { CacheInterceptor } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseInterceptors
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiForbiddenResponse, ApiOperation, ApiParam, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Role } from 'src/application/common/Metadata';
import {
  CreateAdminInstructionRequest,
  UpdateAdminInstructionRequest
} from 'src/application/dtos/request/admin-instruction.request';
import { AdminInstructionResponse } from 'src/application/dtos/response/admin-instruction.response';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { ApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';

/**
 * Controller quản lý chỉ thị admin cho hệ thống AI.
 * Cho phép admin CRUD các instruction dùng để điều khiển hành vi AI.
 */
@ApiTags('Admin Instructions')
@ApiBearerAuth('jwt')
@ApiUnauthorizedResponse({ description: 'Token JWT không hợp lệ hoặc không được cung cấp' })
@ApiForbiddenResponse({ description: 'Yêu cầu role: admin' })
@Controller('admin/instructions')
export class AdminInstructionController {
  constructor(
    private readonly adminInstructionService: AdminInstructionService
  ) { }

  /** Lấy tất cả chỉ thị admin */
  @Get()
  @Role(['admin'])
  @ApiOperation({ summary: 'Lấy tất cả chỉ thị admin' })
  @ApiBaseResponse(AdminInstructionResponse, true)
  async getAllInstructions(): Promise<BaseResponse<AdminInstructionResponse[]>> {
    return await this.adminInstructionService.getAllInstructions();
  }

  /** Lấy chỉ thị theo ID */
  @Get(':id')
  @Role(['admin'])
  @ApiOperation({ summary: 'Lấy chỉ thị admin theo ID' })
  @ApiParam({ name: 'id', description: 'ID của chỉ thị' })
  @ApiBaseResponse(AdminInstructionResponse)
  async getInstructionById(
    @Param('id') id: string
  ): Promise<BaseResponse<AdminInstructionResponse>> {
    return await this.adminInstructionService.getInstructionById(id);
  }

  /** Lấy chỉ thị theo loại */
  @Get('type/:type')
  @Role(['admin'])
  @ApiOperation({ summary: 'Lấy chỉ thị theo loại (system | prompt | rule)' })
  @ApiParam({ name: 'type', description: 'Loại chỉ thị' })
  @ApiBaseResponse(AdminInstructionResponse, true)
  async getInstructionsByType(
    @Param('type') type: string
  ): Promise<BaseResponse<AdminInstructionResponse[]>> {
    return await this.adminInstructionService.getInstructionsByType(type);
  }

  /** Cập nhật chỉ thị */
  @Put(':id')
  @Role(['admin'])
  @ApiOperation({ summary: 'Cập nhật chỉ thị admin' })
  @ApiParam({ name: 'id', description: 'ID của chỉ thị cần cập nhật' })
  @ApiBody({ type: UpdateAdminInstructionRequest })
  @ApiBaseResponse(AdminInstructionResponse)
  async updateInstruction(
    @Param('id') id: string,
    @Body() request: UpdateAdminInstructionRequest
  ): Promise<BaseResponse<AdminInstructionResponse>> {
    return await this.adminInstructionService.updateInstruction(id, request);
  }
}
