import { Controller, Get, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from 'express';
import { Public, Role } from 'src/application/common/Metadata';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ProfileResponse } from 'src/application/dtos/response/profile.response';
import { ProfileService } from 'src/infrastructure/servicies/profile.service';
import { ApiBaseResponse } from 'src/infrastructure/utils/api-response-decorator';
import { extractTokenFromHeader } from 'src/infrastructure/utils/extract-token';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { Ok } from 'src/application/dtos/response/common/success-response';
import { InternalServerErrorWithDetailsException } from 'src/application/common/exceptions/http-with-details.exception';

@Role('admin')
@ApiTags('Profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /** Lấy thông tin profile của người dùng hiện tại */
  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin profile của người dùng hiện tại' })
  @ApiBaseResponse(ProfileResponse)
  async getOwnProfile(
    @Req() request: Request
  ): Promise<BaseResponseAPI<ProfileResponse>> {
    return await this.profileService.getOwnProfile(
      extractTokenFromHeader(request) ?? ''
    );
  }

  /** Tạo báo cáo profile dưới dạng text */
  @Get('report')
  @ApiOperation({ summary: 'Tạo báo cáo profile dưới dạng text' })
  @ApiBaseResponse(String)
  async getProfileReport(
    @Req() request: Request
  ): Promise<BaseResponse<string>> {
    const profile = await this.profileService.getOwnProfile(
      extractTokenFromHeader(request) ?? ''
    );

    if (!profile.success) {
      throw new InternalServerErrorWithDetailsException('Failed to fetch profile', { service: 'ProfileService' });
    }

    const report = await this.profileService.createProfileReport(profile.payload!);
    return Ok(report);
  }
}