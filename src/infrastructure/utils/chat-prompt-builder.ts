import { UIMessage } from 'ai';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { OrderService } from 'src/infrastructure/servicies/order.service';
import { ProfileService } from 'src/infrastructure/servicies/profile.service';
import {
  userLogPrompt,
  orderReportPrompt
} from 'src/application/constant/prompts';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import { convertToUTC } from 'src/infrastructure/utils/time-zone';

/**
 * Kết quả xây dựng combined prompt từ user log + order report.
 */
export interface CombinedPromptResult {
  combinedPrompt: string;
  userLogData: string;
  orderReportData: string;
  profileReport: string;
}

/**
 * Xây dựng combined prompt cho V1 (dùng log tóm tắt từ summary table).
 * Nhanh hơn nhưng phụ thuộc nội dung đã tóm tắt sẵn trong DB.
 *
 * @param logService - UserLogService instance
 * @param orderService - OrderService instance
 * @param profileService - ProfileService instance
 * @param userId - ID người dùng
 * @param authToken - Token xác thực để gọi Order API và Profile API
 * @returns Combined prompt + dữ liệu thành phần
 */
export async function buildCombinedPromptV1(
  logService: UserLogService,
  orderService: OrderService,
  profileService: ProfileService,
  userId: string,
  authToken: string
): Promise<BaseResponse<CombinedPromptResult>> {
  // Lấy log tóm tắt từ bảng user_log_summary
  const userLog = await logService.getUserLogSummaryReportByUserId(userId);
  const userLogData = userLog.data ?? '';
  const userLogPromptText = userLogPrompt(userLogData);

  // Lấy order report
  const orderReport =
    await orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
      userId,
      authToken
    );
  const orderReportData = orderReport.data ?? '';

  // Lấy profile
  const profile = await profileService.getOwnProfile(authToken);
  const profileReport = await profileService.createSystemPromptFromProfile(profile.payload!);

  const combinedPrompt = `${userLogPromptText}\n\n
    Order Report:\n${orderReportPrompt(orderReportData)}\n\n
    Profile:\n${profileReport ?? ''}`;

  return {
    success: true,
    data: {
      combinedPrompt,
      userLogData,
      orderReportData,
      profileReport: profileReport ?? ''
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
 * @param userId - ID người dùng
 * @param authToken - Token xác thực để gọi Order API và Profile API
 * @returns Combined prompt + dữ liệu thành phần
 */
export async function buildCombinedPromptV2(
  logService: UserLogService,
  orderService: OrderService,
  profileService: ProfileService,
  userId: string,
  authToken: string
): Promise<BaseResponse<CombinedPromptResult>> {
  // Lấy log chi tiết và tổng hợp real-time
  const userLogResponse = await logService.getReportAndPromptSummaryUserLogs({
    userId,
    period: PeriodEnum.MONTHLY,
    endDate: convertToUTC(new Date()),
    startDate: undefined
  });
  const userLogData = userLogResponse.data ? userLogResponse.data.response : '';

  // Lấy order report
  const orderReport =
    await orderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId(
      userId,
      authToken
    );
  const orderReportData = orderReport.data ?? '';

  // Lấy profile
  const profile = await profileService.getOwnProfile(authToken);
  const profileReport = await profileService.createSystemPromptFromProfile(profile.payload!);

  const combinedPrompt = `${userLogData}\n\n
    Order Report:\n${orderReportPrompt(orderReportData)}\n\n
    Profile:\n${profileReport ?? ''}`;

  return {
    success: true,
    data: {
      combinedPrompt,
      userLogData,
      orderReportData,
      profileReport: profileReport ?? ''
    }
  };
}
