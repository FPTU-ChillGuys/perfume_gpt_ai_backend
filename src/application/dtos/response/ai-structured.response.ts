import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Metadata bổ sung cho response AI */
export class AIResponseMetadata {
  /** Thời gian xử lý (ms) */
  @ApiProperty({ description: 'Thời gian xử lý (milli giây)' })
  processingTimeMs: number;

  /** Ước tính số token đầu vào */
  @ApiPropertyOptional({ description: 'Ước tính số token đầu vào' })
  inputTokenEstimate?: number;

  constructor(init?: Partial<AIResponseMetadata>) {
    Object.assign(this, init);
  }
}

/** Response có cấu trúc cho kết quả phân tích AI (thay vì trả raw string) */
export class AIAnalysisResponse {
  /** Nội dung AI đã tạo */
  @ApiProperty({ description: 'Nội dung AI đã sinh ra' })
  content: string;

  /** Thời điểm tạo response */
  @ApiProperty({ description: 'Thời điểm tạo kết quả' })
  generatedAt: Date;

  /** Metadata bổ sung */
  @ApiPropertyOptional({ description: 'Thông tin bổ sung', type: AIResponseMetadata })
  metadata?: AIResponseMetadata;

  constructor(init?: Partial<AIAnalysisResponse>) {
    Object.assign(this, init);
  }
}

/** Response có cấu trúc cho tóm tắt đánh giá sản phẩm */
export class AIReviewSummaryStructuredResponse {
  /** Nội dung tóm tắt */
  @ApiProperty({ description: 'Nội dung tóm tắt đánh giá' })
  summary: string;

  /** ID variant được tóm tắt */
  @ApiProperty({ description: 'Variant ID liên quan' })
  variantId: string;

  /** Số lượng review đã phân tích */
  @ApiProperty({ description: 'Số lượng review đã phân tích' })
  reviewCount: number;

  /** Thời điểm tạo */
  @ApiProperty({ description: 'Thời điểm tạo kết quả' })
  generatedAt: Date;

  /** Metadata bổ sung */
  @ApiPropertyOptional({ description: 'Thông tin bổ sung', type: AIResponseMetadata })
  metadata?: AIResponseMetadata;

  constructor(init?: Partial<AIReviewSummaryStructuredResponse>) {
    Object.assign(this, init);
  }
}

/** Response có cấu trúc cho dự báo xu hướng */
export class AITrendForecastStructuredResponse {
  /** Nội dung dự báo xu hướng */
  @ApiProperty({ description: 'Nội dung dự báo xu hướng' })
  forecast: string;

  /** Danh sách item đã chấm điểm trend */
  @ApiProperty({
    description: 'Danh sách sản phẩm đã được xếp hạng theo trend score',
    type: () => [AITrendItemStructuredResponse]
  })
  trendItems: AITrendItemStructuredResponse[];

  /** Khoảng thời gian phân tích */
  @ApiProperty({ description: 'Khoảng thời gian phân tích' })
  period: string;

  /** Số lượng user log đã dùng */
  @ApiProperty({ description: 'Số lượng user log đã phân tích' })
  analyzedLogCount: number;

  /** Thời điểm tạo */
  @ApiProperty({ description: 'Thời điểm tạo kết quả' })
  generatedAt: Date;

  /** Metadata bổ sung */
  @ApiPropertyOptional({ description: 'Thông tin bổ sung', type: AIResponseMetadata })
  metadata?: AIResponseMetadata;

  constructor(init?: Partial<AITrendForecastStructuredResponse>) {
    Object.assign(this, init);
  }
}

export class AITrendSignalStructuredResponse {
  @ApiProperty({ description: 'Tên tín hiệu', example: 'BEST_SELLER_SUPPORT' })
  code: string;

  @ApiProperty({ description: 'Mô tả tín hiệu', example: 'Sản phẩm có hỗ trợ từ dữ liệu bán chạy.' })
  description: string;

  constructor(init?: Partial<AITrendSignalStructuredResponse>) {
    Object.assign(this, init);
  }
}

export class AITrendItemStructuredResponse {
  @ApiProperty({ description: 'ID sản phẩm', format: 'uuid' })
  productId: string;

  @ApiProperty({ description: 'Tên sản phẩm' })
  productName: string;

  @ApiProperty({ description: 'ID variant đại diện', format: 'uuid', nullable: true })
  variantId: string | null;

  @ApiProperty({ description: 'Điểm trend (0-100)', example: 82 })
  trendScore: number;

  @ApiProperty({ description: 'Độ tin cậy (0-100)', example: 76 })
  confidence: number;

  @ApiProperty({ description: 'Nhãn hiển thị trend', example: 'Rising' })
  badgeType: string;

  @ApiProperty({
    description: 'Các tín hiệu chính dùng để giải thích vì sao sản phẩm trend',
    type: () => [AITrendSignalStructuredResponse]
  })
  signals: AITrendSignalStructuredResponse[];

  @ApiProperty({ description: 'Tổng bán 7 ngày gần nhất', example: 35 })
  last7DaysSales: number;

  @ApiProperty({ description: 'Tổng bán 30 ngày gần nhất', example: 110 })
  last30DaysSales: number;

  constructor(init?: Partial<AITrendItemStructuredResponse>) {
    Object.assign(this, init);
  }
}

/** Response có cấu trúc cho tóm tắt đơn hàng */
export class AIOrderSummaryStructuredResponse {
  /** Nội dung tóm tắt đơn hàng */
  @ApiProperty({ description: 'Nội dung tóm tắt đơn hàng' })
  summary: string;

  /** ID người dùng */
  @ApiProperty({ description: 'User ID liên quan' })
  userId: string;

  /** Thời điểm tạo */
  @ApiProperty({ description: 'Thời điểm tạo kết quả' })
  generatedAt: Date;

  /** Metadata bổ sung */
  @ApiPropertyOptional({ description: 'Thông tin bổ sung', type: AIResponseMetadata })
  metadata?: AIResponseMetadata;

  constructor(init?: Partial<AIOrderSummaryStructuredResponse>) {
    Object.assign(this, init);
  }
}

/** Response có cấu trúc cho báo cáo tồn kho AI */
export class AIInventoryReportStructuredResponse {
  /** Nội dung báo cáo tồn kho */
  @ApiProperty({ description: 'Nội dung báo cáo tồn kho AI' })
  report: string;

  /** Thời điểm tạo */
  @ApiProperty({ description: 'Thời điểm tạo kết quả' })
  generatedAt: Date;

  /** Metadata bổ sung */
  @ApiPropertyOptional({ description: 'Thông tin bổ sung', type: AIResponseMetadata })
  metadata?: AIResponseMetadata;

  constructor(init?: Partial<AIInventoryReportStructuredResponse>) {
    Object.assign(this, init);
  }
}

/** Response có cấu trúc cho gợi ý sản phẩm AI */
export class AIRecommendationStructuredResponse {
  /** Nội dung gợi ý */
  @ApiProperty({ description: 'Nội dung gợi ý từ AI' })
  recommendation: string;

  /** ID người dùng */
  @ApiProperty({ description: 'User ID liên quan' })
  userId: string;

  /** Khoảng thời gian phân tích */
  @ApiProperty({ description: 'Khoảng thời gian phân tích' })
  period: string;

  /** Thời điểm tạo */
  @ApiProperty({ description: 'Thời điểm tạo kết quả' })
  generatedAt: Date;

  /** Metadata bổ sung */
  @ApiPropertyOptional({ description: 'Thông tin bổ sung', type: AIResponseMetadata })
  metadata?: AIResponseMetadata;

  constructor(init?: Partial<AIRecommendationStructuredResponse>) {
    Object.assign(this, init);
  }
}
