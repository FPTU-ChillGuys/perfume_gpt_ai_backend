import { UIMessage } from 'ai';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { UserLogService } from 'src/infrastructure/servicies/user-log.service';
import { OrderService } from 'src/infrastructure/servicies/order.service';
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
}

/**
 * Xây dựng combined prompt cho V1 (dùng log tóm tắt từ summary table).
 * Nhanh hơn nhưng phụ thuộc nội dung đã tóm tắt sẵn trong DB.
 *
 * @param logService - UserLogService instance
 * @param orderService - OrderService instance
 * @param userId - ID người dùng
 * @param authToken - Token xác thực để gọi Order API
 * @returns Combined prompt + dữ liệu thành phần
 */
export async function buildCombinedPromptV1(
  logService: UserLogService,
  orderService: OrderService,
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

  const combinedPrompt = `${userLogPromptText}\n\nOrder Report:\n${orderReportPrompt(orderReportData)}`;

  return {
    success: true,
    data: {
      combinedPrompt,
      userLogData,
      orderReportData
    }
  };
}

/**
 * Xây dựng combined prompt cho V2 (dùng log chi tiết, tổng hợp real-time).
 * Chậm hơn nhưng luôn đầy đủ nội dung.
 *
 * @param logService - UserLogService instance
 * @param orderService - OrderService instance
 * @param userId - ID người dùng
 * @param authToken - Token xác thực để gọi Order API
 * @returns Combined prompt + dữ liệu thành phần
 */
export async function buildCombinedPromptV2(
  logService: UserLogService,
  orderService: OrderService,
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

  const combinedPrompt = `${userLogData}\n\nOrder Report:\n${orderReportPrompt(orderReportData)}`;

  return {
    success: true,
    data: {
      combinedPrompt,
      userLogData,
      orderReportData
    }
  };
}
