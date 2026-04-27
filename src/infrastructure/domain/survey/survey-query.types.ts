import { ApiProperty, getSchemaPath } from '@nestjs/swagger';

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

/** Match chính xác 1 giá trị (gender, origin, brand, category, concentration, note, family) */
export class QueryFragmentMatch {
  @ApiProperty({ enum: SURVEY_ATTRIBUTE_TYPES, description: 'Loại thuộc tính (trừ attribute và budget)' })
  type: Exclude<SurveyAttributeType, 'attribute' | 'budget'>;

  @ApiProperty({ description: 'Giá trị cần khớp chính xác' })
  match: string;
}

/** Match một giá trị thuộc tính sản phẩm (attribute) */
export class QueryFragmentAttribute {
  @ApiProperty({ enum: ['attribute'] })
  type: 'attribute';

  @ApiProperty({ description: 'Tên loại thuộc tính (ví dụ: Nồng độ, Độ lưu hương)' })
  attributeName: string;

  @ApiProperty({ description: 'Giá trị thuộc tính cần khớp' })
  match: string;
}

/** Khoảng ngân sách (budget) */
export class QueryFragmentBudget {
  @ApiProperty({ enum: ['budget'] })
  type: 'budget';

  @ApiProperty({ required: false, description: 'Giá tối thiểu' })
  min?: number;

  @ApiProperty({ required: false, description: 'Giá tối đa' })
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
export class SurveyAttributeTypeInfo {
  @ApiProperty({ enum: SURVEY_ATTRIBUTE_TYPES })
  type: SurveyAttributeType;

  @ApiProperty()
  label: string;

  @ApiProperty()
  description: string;
}

export class SurveyAttributeValueItem {
  @ApiProperty()
  displayText: string;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(QueryFragmentMatch) },
      { $ref: getSchemaPath(QueryFragmentAttribute) },
      { $ref: getSchemaPath(QueryFragmentBudget) },
    ],
  })
  queryFragment: QueryFragment;
}

export class SurveyAttributeValuesResponse {
  @ApiProperty({ enum: SURVEY_ATTRIBUTE_TYPES })
  type: SurveyAttributeType;

  @ApiProperty()
  label: string;

  @ApiProperty({ type: [SurveyAttributeValueItem], required: false })
  values?: SurveyAttributeValueItem[];

  @ApiProperty({ required: false })
  subGroups?: {
    attributeName: string;
    values: SurveyAttributeValueItem[];
  }[];
}

// ── Request tạo câu hỏi từ thuộc tính ────────────────────────────
export class CreateQuestionFromAttributeRequest {
  @ApiProperty()
  question: string;

  @ApiProperty({ enum: ['single', 'multiple'] })
  questionType: 'single' | 'multiple';

  @ApiProperty({ enum: SURVEY_ATTRIBUTE_TYPES })
  attributeType: SurveyAttributeType;

  @ApiProperty({ required: false })
  attributeName?: string;

  @ApiProperty({ type: [String], required: false })
  selectedValues?: string[];

  @ApiProperty({ required: false })
  budgetRanges?: { label: string; min?: number; max?: number }[];
}
