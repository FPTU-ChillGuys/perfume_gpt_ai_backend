import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from 'src/application/common/Metadata';
import {
  CreateAdminInstructionRequest,
  UpdateAdminInstructionRequest
} from 'src/application/dtos/request/admin-instruction.request';
import { AdminInstructionResponse } from 'src/application/dtos/response/admin-instruction.response';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';

/**
 * Controller quản lý chỉ thị admin cho hệ thống AI.
 * Cho phép admin CRUD các instruction dùng để điều khiển hành vi AI.
 */
@ApiTags('Admin Instructions')
@Controller('admin/instructions')
export class AdminInstructionController {
  constructor(
    private readonly adminInstructionService: AdminInstructionService
  ) {}

  /** Lấy tất cả chỉ thị admin */
  @Get()
  @Role('admin')
  @ApiOperation({ summary: 'Lấy tất cả chỉ thị admin' })
  @ApiBaseResponse(AdminInstructionResponse, true)
  async getAllInstructions(): Promise<BaseResponse<AdminInstructionResponse[]>> {
    return await this.adminInstructionService.getAllInstructions();
  }

  /** Lấy chỉ thị theo ID */
  @Get(':id')
  @Role('admin')
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
  @Role('admin')
  @ApiOperation({ summary: 'Lấy chỉ thị theo loại (system | prompt | rule)' })
  @ApiParam({ name: 'type', description: 'Loại chỉ thị' })
  @ApiBaseResponse(AdminInstructionResponse, true)
  async getInstructionsByType(
    @Param('type') type: string
  ): Promise<BaseResponse<AdminInstructionResponse[]>> {
    return await this.adminInstructionService.getInstructionsByType(type);
  }

  /** Gộp chỉ thị theo loại thành chuỗi prompt cho AI */
  @Get('combined/:type')
  @Role('admin')
  @ApiOperation({ summary: 'Gộp chỉ thị theo loại thành prompt cho AI' })
  @ApiParam({ name: 'type', description: 'Loại chỉ thị cần gộp' })
  @ApiBaseResponse(String)
  async getCombinedPromptByType(
    @Param('type') type: string
  ): Promise<BaseResponse<string>> {
    return await this.adminInstructionService.getCombinedPromptByType(type);
  }

  /** Tạo chỉ thị mới */
  @Post()
  @Role('admin')
  @ApiOperation({ summary: 'Tạo chỉ thị admin mới' })
  @ApiBody({ type: CreateAdminInstructionRequest })
  @ApiBaseResponse(AdminInstructionResponse)
  async createInstruction(
    @Body() request: CreateAdminInstructionRequest
  ): Promise<BaseResponse<AdminInstructionResponse>> {
    return await this.adminInstructionService.createInstruction(request);
  }

  /** Cập nhật chỉ thị */
  @Put(':id')
  @Role('admin')
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

  /** Xóa chỉ thị */
  @Delete(':id')
  @Role('admin')
  @ApiOperation({ summary: 'Xóa chỉ thị admin' })
  @ApiParam({ name: 'id', description: 'ID của chỉ thị cần xóa' })
  @ApiBaseResponse(Boolean)
  async deleteInstruction(
    @Param('id') id: string
  ): Promise<BaseResponse<boolean>> {
    return await this.adminInstructionService.deleteInstruction(id);
  }
}
