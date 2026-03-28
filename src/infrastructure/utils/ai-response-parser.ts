/**
 * Interface cho AI Recommendation Response
 */
export interface AIRecommendationResponse {
  message: string;
  products?: Array<{
    id: string;
    name: string;
    description: string;
    brandName: string;
    categoryName: string;
    primaryImage?: string;
    variants?: Array<{
      id: string;
      sku: string;
      volumeMl: number;
      type: string;
      basePrice: number;
      status: string;
      concentrationName: string;
    }>;
  }>;
  suggestedQuestions?: string[];
}

/**
 * Parse AI response để tách message và products
 * @param response String response từ AI
 * @returns Parsed object với message và products
 */
export function parseAIRecommendationResponse(
  response: string
): AIRecommendationResponse {
  try {
    // Cố gắng parse JSON từ response
    const parsed = JSON.parse(response);
    return {
      message: parsed.message || response,
      products: parsed.products || [],
      suggestedQuestions: parsed.suggestedQuestions || []
    };
  } catch (error) {
    // Nếu không parse được, treat toàn bộ response là message
    return {
      message: response,
      products: []
    };
  }
}

/**
 * Extract plain text message từ AI response
 * Bỏ qua các dòng chứa tên sản phẩm và chỉ lấy phần mô tả
 */
export function extractMessageFromResponse(response: string): string {
  try {
    const parsed = JSON.parse(response);
    if (parsed.message) {
      return parsed.message;
    }
  } catch {
    // Nếu là plain text, cắt ở phần "products"
    if (response.includes('"products"')) {
      const messageEnd = response.indexOf('"products"');
      return response.substring(0, messageEnd).trim();
    }
  }
  return response;
}
