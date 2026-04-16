/**
 * Survey v4 — Query-based answer types.
 * Mỗi câu trả lời survey lưu một queryFragment JSON,
 * cho phép trực tiếp query sản phẩm mà không cần AI phân tích keyword.
 */

// ── Các loại thuộc tính có thể dùng cho survey ────────────────────
export const SURVEY_ATTRIBUTE_TYPES = [
  'gender',
  'origin',
  'brand',
  'category',
  'concentration',
  'note',
  'family',
  'attribute',
  'budget',
] as const;

export type SurveyAttributeType = (typeof SURVEY_ATTRIBUTE_TYPES)[number];

// ── Query Fragment: phần query nhúng trong mỗi answer ─────────────
export interface QueryFragmentBase {
  type: SurveyAttributeType;
}

/** Match chính xác 1 giá trị (gender, origin, brand, category, concentration, note, family) */
export interface QueryFragmentMatch extends QueryFragmentBase {
  type: Exclude<SurveyAttributeType, 'attribute' | 'budget'>;
  match: string;
}

/** Match một giá trị thuộc tính sản phẩm (attribute) */
export interface QueryFragmentAttribute extends QueryFragmentBase {
  type: 'attribute';
  attributeName: string;
  match: string;
}

/** Khoảng ngân sách (budget) */
export interface QueryFragmentBudget extends QueryFragmentBase {
  type: 'budget';
  min?: number;
  max?: number;
}

export type QueryFragment =
  | QueryFragmentMatch
  | QueryFragmentAttribute
  | QueryFragmentBudget;

// ── Answer payload chứa cả displayText và query ──────────────────
export interface QueryAnswerPayload {
  displayText: string;
  queryFragment: QueryFragment;
}

// ── Validation result ─────────────────────────────────────────────
export interface QueryValidationResult {
  valid: boolean;
  errors: string[];
}

// ── Response types cho API lấy thuộc tính ─────────────────────────
export interface SurveyAttributeTypeInfo {
  type: SurveyAttributeType;
  label: string;
  description: string;
}

export interface SurveyAttributeValueItem {
  displayText: string;
  queryFragment: QueryFragment;
}

export interface SurveyAttributeValuesResponse {
  type: SurveyAttributeType;
  label: string;
  values?: SurveyAttributeValueItem[];
  /** Chỉ dùng cho type = 'attribute' — gom theo từng attribute */
  subGroups?: {
    attributeName: string;
    values: SurveyAttributeValueItem[];
  }[];
}

// ── Request tạo câu hỏi từ thuộc tính ────────────────────────────
export interface CreateQuestionFromAttributeRequest {
  question: string;
  questionType: 'single' | 'multiple';
  attributeType: SurveyAttributeType;
  /** Bắt buộc khi attributeType = 'attribute' */
  attributeName?: string;
  /** Chỉ chọn một số giá trị, không phải tất cả */
  selectedValues?: string[];
  /** Dùng cho budget: danh sách các khoảng giá */
  budgetRanges?: { label: string; min?: number; max?: number }[];
}
