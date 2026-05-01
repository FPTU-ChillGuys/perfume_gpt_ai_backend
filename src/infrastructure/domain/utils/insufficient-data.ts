/**
 * Utility kiểm tra dữ liệu đủ điều kiện cho AI phân tích.
 * Khi dữ liệu chưa đủ, trả về thông báo thân thiện thay vì gọi AI với dữ liệu trống.
 *
 * Lưu ý: Product search KHÔNG áp dụng logic này — luôn hoạt động bình thường.
 */

/** Thông báo chung khi thiếu dữ liệu */
export const INSUFFICIENT_DATA_MESSAGES = {
  REVIEW_SUMMARY:
    'Chưa đủ dữ liệu đánh giá để tóm tắt. Vui lòng quay lại sau khi có thêm đánh giá từ khách hàng.',
  ORDER_SUMMARY:
    'Chưa đủ dữ liệu đơn hàng để tạo báo cáo AI. Người dùng này chưa có đơn hàng nào.',
  INVENTORY_REPORT:
    'Chưa đủ dữ liệu tồn kho để tạo báo cáo AI. Vui lòng kiểm tra lại dữ liệu kho.',
  TREND_FORECAST:
    'Chưa đủ dữ liệu hành vi người dùng để dự đoán xu hướng. Cần thêm dữ liệu log hoạt động.',
  RECOMMENDATION:
    'Chưa đủ dữ liệu để đưa ra gợi ý. Người dùng cần có lịch sử hoạt động hoặc đơn hàng.',
  REPURCHASE:
    'Chưa đủ dữ liệu để gợi ý mua lại. Người dùng cần có lịch sử mua hàng.',
  LOG_SUMMARIZE:
    'Chưa đủ dữ liệu log để tóm tắt. Người dùng chưa có hoạt động nào trong khoảng thời gian này.'
} as const;

/**
 * Kiểm tra chuỗi dữ liệu có nội dung thực sự hay không.
 * Trả về true nếu chuỗi rỗng, null, undefined hoặc chỉ chứa khoảng trắng.
 */
export function isDataEmpty(data: string | null | undefined): boolean {
  return !data || data.trim().length === 0;
}

/**
 * Kiểm tra mảng có dữ liệu hay không.
 * Trả về true nếu mảng rỗng, null hoặc undefined.
 */
export function isArrayEmpty<T>(arr: T[] | null | undefined): boolean {
  return !arr || arr.length === 0;
}

/**
 * Tạo thông báo thiếu dữ liệu chi tiết cho từng thành phần trong combined prompt.
 * Dùng cho chatbot conversation — không block mà chỉ ghi chú phần nào thiếu.
 */
export function buildDataAvailabilityNote(parts: {
  hasUserLog: boolean;
  hasOrderReport: boolean;
  hasProfile: boolean;
}): string {
  const missing: string[] = [];

  if (!parts.hasUserLog) missing.push('lịch sử hoạt động (user log)');
  if (!parts.hasOrderReport) missing.push('lịch sử đơn hàng (order history)');
  if (!parts.hasProfile) missing.push('hồ sơ cá nhân (profile)');

  if (missing.length === 0) return '';

  return `\n\n[Lưu ý hệ thống: Chưa đủ dữ liệu cho các phần sau: ${missing.join(', ')}. Hãy trả lời dựa trên thông tin có sẵn và thông báo cho người dùng rằng kết quả sẽ chính xác hơn khi có đầy đủ dữ liệu.]`;
}
