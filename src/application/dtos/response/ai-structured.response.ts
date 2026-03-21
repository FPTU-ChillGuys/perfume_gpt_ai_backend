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
