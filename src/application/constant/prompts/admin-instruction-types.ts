/**
 * Admin Instruction Type Constants
 * Các loại instruction domain mà admin có thể quản lý qua API.
 * Mỗi loại tương ứng với một nhóm AI endpoint.
 *
 * Admin tạo instruction với instructionType = một trong các giá trị bên dưới.
 * Khi AI endpoint chạy, nó sẽ fetch admin instructions theo type tương ứng
 * và inject làm system prompt bổ sung cho AI.
 */

/** Loại instruction cho tóm tắt đánh giá sản phẩm */
export const INSTRUCTION_TYPE_REVIEW = 'review';

/** Loại instruction cho báo cáo đơn hàng */
export const INSTRUCTION_TYPE_ORDER = 'order';

/** Loại instruction cho báo cáo tồn kho */
export const INSTRUCTION_TYPE_INVENTORY = 'inventory';

/** Loại instruction cho dự đoán xu hướng */
export const INSTRUCTION_TYPE_TREND = 'trend';

/** Loại instruction cho gợi ý sản phẩm AI (aiRecommendationV1, aiRecommendationV2, aiRecommendationStructured) */
export const INSTRUCTION_TYPE_RECOMMENDATION = 'recommendation';

/** Loại instruction cho gợi ý mua lại (repurchaseRecommendationV1, repurchaseRecommendationV2) */
export const INSTRUCTION_TYPE_REPURCHASE = 'repurchase';

/** Loại instruction cho tóm tắt log người dùng */
export const INSTRUCTION_TYPE_LOG = 'log';

/** Loại instruction cho chatbot conversation */
export const INSTRUCTION_TYPE_CONVERSATION = 'conversation';

/** Loại instruction cho survey tư vấn nước hoa */
export const INSTRUCTION_TYPE_SURVEY = 'survey';

/** Loại instruction cho phân tích nhu cầu nhập hàng (restock) */
export const INSTRUCTION_TYPE_RESTOCK = 'restock';

/** Loại instruction cho trích xuất thông tin tìm kiếm nước hoa (search extraction) */
export const INSTRUCTION_TYPE_SEARCH_EXTRACTION = 'search_extraction';

/** Loại instruction cho tư vấn nội bộ cửa hàng (Staff Consultation) */
export const INSTRUCTION_TYPE_STAFF_CONSULTATION = 'staff_consultation';

/** Loại instruction cho phân tích ý định (intent only) */
export const INSTRUCTION_TYPE_INTENT_ONLY_ANALYSIS = 'intent_only_analysis';

/** Loại instruction cho chuẩn hóa dữ liệu nội bộ (internal normalization) */
export const INSTRUCTION_TYPE_INTERNAL_NORMALIZATION = 'internal_normalization';

/** Loại instruction cho phân tích survey (tổng thể) */
export const INSTRUCTION_TYPE_SURVEY_ANALYSIS = 'survey_analysis';

/** Loại instruction cho phân tích trend (từ Google Trends) */
export const INSTRUCTION_TYPE_TREND_ANALYSIS = 'trend_analysis';

/** Loại instruction cho phân tích từng câu trả lời survey */
export const INSTRUCTION_TYPE_SURVEY_ANSWER_ANALYSIS = 'survey_answer_analysis';

/** Danh sách tất cả các loại instruction hợp lệ */
export const ALL_INSTRUCTION_TYPES = [
  INSTRUCTION_TYPE_REVIEW,
  INSTRUCTION_TYPE_ORDER,
  INSTRUCTION_TYPE_INVENTORY,
  INSTRUCTION_TYPE_TREND,
  INSTRUCTION_TYPE_RECOMMENDATION,
  INSTRUCTION_TYPE_REPURCHASE,
  INSTRUCTION_TYPE_LOG,
  INSTRUCTION_TYPE_CONVERSATION,
  INSTRUCTION_TYPE_SURVEY,
  INSTRUCTION_TYPE_RESTOCK,
  INSTRUCTION_TYPE_SEARCH_EXTRACTION,
  INSTRUCTION_TYPE_STAFF_CONSULTATION,
  INSTRUCTION_TYPE_INTENT_ONLY_ANALYSIS,
  INSTRUCTION_TYPE_INTERNAL_NORMALIZATION,
  INSTRUCTION_TYPE_SURVEY_ANALYSIS,
  INSTRUCTION_TYPE_TREND_ANALYSIS,
  INSTRUCTION_TYPE_SURVEY_ANSWER_ANALYSIS
] as const;

export type InstructionDomainType = (typeof ALL_INSTRUCTION_TYPES)[number];
