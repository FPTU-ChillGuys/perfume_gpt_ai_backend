import { UIMessage } from 'ai';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { OrderService } from 'src/infrastructure/servicies/order.service';
import { ProfileService } from 'src/infrastructure/servicies/profile.service';
import { AdminInstructionService } from 'src/infrastructure/servicies/admin-instruction.service';
import {
  userLogPrompt,
  orderReportPrompt,
  INSTRUCTION_TYPE_CONVERSATION
} from 'src/application/constant/prompts';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { convertToUTC } from 'src/infrastructure/utils/time-zone';
import { isDataEmpty, buildDataAvailabilityNote } from 'src/infrastructure/utils/insufficient-data';

/**
 * Kết quả xây dựng combined prompt từ user log + order report.
 */
export interface CombinedPromptResult {
  combinedPrompt: string;
  userLogData: string;
  orderReportData: string;
  profileReport: string;
  adminInstruction: string;
}

/**
 * Xây dựng combined prompt cho V1 (dùng log tóm tắt từ summary table).
 * Nhanh hơn nhưng phụ thuộc nội dung đã tóm tắt sẵn trong DB.
 *
 * @param logService - UserLogService instance
 * @param orderService - OrderService instance
 * @param profileService - ProfileService instance
 * @param adminInstructionService - AdminInstructionService instance
 * @param userId - ID người dùng
 * @param authToken - Token xác thực để gọi Order API và Profile API
 * @returns Combined prompt + dữ liệu thành phần
 */
export async function buildCombinedPromptV1(
  logService: UserLogService,
  orderService: OrderService,
  profileService: ProfileService,
  adminInstructionService: AdminInstructionService,
  userId: string | undefined,
  authToken: string
): Promise<BaseResponse<CombinedPromptResult>> {
  let userLogData = '';
  let userLogPromptText = '';
  let orderReportData = '';
  let profileReport = '';

  // Chỉ lấy log và order khi có userId (user đã đăng nhập)
  if (userId) {
    const userLog = await logService.getUserLogSummaryReportByUserId(userId);
    userLogData = userLog.data ?? '';
    userLogPromptText = userLogPrompt(userLogData);

    const orderReport =
      await orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
        userId,
        authToken
      );
    orderReportData = orderReport.data ?? '';
  }

  // Profile chỉ lấy được khi có auth token
  if (authToken) {
    const profile = await profileService.getOwnProfile(authToken);
    profileReport = await profileService.createSystemPromptFromProfile(profile.payload!) ?? '';
  }

  // Lấy admin instruction cho conversation (nếu có)
  const adminInstruction = await adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_CONVERSATION);

  // Kiểm tra dữ liệu và thêm ghi chú nếu thiếu
  const dataNote = buildDataAvailabilityNote({
    hasUserLog: !isDataEmpty(userLogData),
    hasOrderReport: !isDataEmpty(orderReportData),
    hasProfile: !isDataEmpty(profileReport)
  });

  const combinedPrompt = `${userLogPromptText}\n\n
    Order Report:\n${orderReportPrompt(orderReportData)}\n\n
    Profile:\n${profileReport ?? ''}${dataNote}${adminInstruction ? `\n\nAdmin Instructions:\n${adminInstruction}` : ''}`;

  return {
    success: true,
    data: {
      combinedPrompt,
      userLogData,
      orderReportData,
      profileReport: profileReport ?? '',
      adminInstruction
    }
  };
}

/**
 * Xây dựng combined prompt cho V2 (dùng log chi tiết, tổng hợp real-time).
 * Chậm hơn nhưng luôn đầy đủ nội dung.
 *
 * @param logService - UserLogService instance
 * @param orderService - OrderService instance
 * @param profileService - ProfileService instance
 * @param adminInstructionService - AdminInstructionService instance
 * @param userId - ID người dùng
 * @param authToken - Token xác thực để gọi Order API và Profile API
 * @returns Combined prompt + dữ liệu thành phần
 */
export async function buildCombinedPromptV2(
  logService: UserLogService,
  orderService: OrderService,
  profileService: ProfileService,
  adminInstructionService: AdminInstructionService,
  userId: string | undefined,
  authToken: string
): Promise<BaseResponse<CombinedPromptResult>> {
  let userLogData = '';
  let orderReportData = '';
  let profileReport = '';

  // Chỉ lấy log và order khi có userId (user đã đăng nhập)
  if (userId) {
    const userLogResponse = await logService.getReportAndPromptSummaryUserLogs({
      userId,
      period: PeriodEnum.MONTHLY,
      endDate: convertToUTC(new Date()),
      startDate: undefined
    });
    userLogData = userLogResponse.data ? userLogResponse.data.response : '';

    const orderReport =
      await orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
        userId,
        authToken
      );
    orderReportData = orderReport.data ?? '';
  }

  // Profile chỉ lấy được khi có auth token
  if (authToken) {
    const profile = await profileService.getOwnProfile(authToken);
    profileReport = await profileService.createSystemPromptFromProfile(profile.payload!) ?? '';
  }

  // Lấy admin instruction cho conversation (nếu có)
  const adminInstruction = await adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_CONVERSATION);

  // Kiểm tra dữ liệu và thêm ghi chú nếu thiếu
  const dataNote = buildDataAvailabilityNote({
    hasUserLog: !isDataEmpty(userLogData),
    hasOrderReport: !isDataEmpty(orderReportData),
    hasProfile: !isDataEmpty(profileReport)
  });

  const combinedPrompt = `${userLogData}\n\n
    Order Report:\n${orderReportPrompt(orderReportData)}\n\n
    Profile:\n${profileReport ?? ''}${dataNote}${adminInstruction ? `\n\nAdmin Instructions:\n${adminInstruction}` : ''}`;

  return {
    success: true,
    data: {
      combinedPrompt,
      userLogData,
      orderReportData,
      profileReport: profileReport ?? '',
      adminInstruction
    }
  };
}
