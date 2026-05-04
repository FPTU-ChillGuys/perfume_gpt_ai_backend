export interface SurveyAnalysis {
  logic?: (string | string[])[] | null;
  genderValues?: string[];
  originValues?: string[];
  concentrationValues?: string[];
  budget?: { min?: number | null; max?: number | null } | null;
  pagination?: { pageNumber: number; pageSize: number } | null;
  sorting?: { field: string; isDescending: boolean } | null;
  [key: string]: unknown;
}

export interface PerQuestionAnalysis {
  questionId: string;
  question: string;
  answer: string;
  analysis: SurveyAnalysis | null;
}

export interface SurveyAIResponse {
  products?: Record<string, unknown>[];
  productTemp?: Record<string, unknown>[];
  aiAcceptanceId?: string;
  [key: string]: unknown;
}
