/**
 * Utility functions for merging survey query results.
 * Implements score-based merge strategy: products appearing in multiple queries get higher scores.
 */

export interface SurveyQueryResult {
  questionId: string;
  products: any[];
}

/**
 * Merge multiple survey query results using score-based deduplication.
 * Products that appear in multiple queries get higher priority.
 * 
 * @param results Array of query results from individual questions
 * @param topN Maximum number of products to return (default: 20)
 * @returns Merged and sorted product array
 */
export function mergeSurveyQueryResults(
  results: SurveyQueryResult[],
  topN: number = 20
): any[] {
  const scoreMap = new Map<string, { product: any; score: number; sources: string[] }>();

  // CRITICAL: Filter out queries with 0 products BEFORE merging
  const validResults = results.filter(r => r.products && r.products.length > 0);
  
  if (validResults.length === 0) {
    console.log(`[SurveyMerge] No queries with products found. Returning empty array.`);
    return [];
  }

  console.log(`[SurveyMerge] Filtering: ${results.length} total queries -> ${validResults.length} queries with products`);

  // Score each product based on how many queries it appears in
  for (const result of validResults) {
    const { questionId, products } = result;

    for (const product of products) {
      const existing = scoreMap.get(product.id);
      
      if (existing) {
        existing.score += 1;
        existing.sources.push(questionId);
      } else {
        scoreMap.set(product.id, {
          product,
          score: 1,
          sources: [questionId]
        });
      }
    }
  }

  // Convert to array and sort by score descending
  const sorted = Array.from(scoreMap.values()).sort((a, b) => b.score - a.score);

  // Take top N products
  const topProducts = sorted.slice(0, topN).map(item => item.product);

  // Log merge statistics
  console.log(`[SurveyMerge] Merged ${topProducts.length} unique products from ${validResults.length} queries with results`);
  
  if (topProducts.length > 0) {
    const topProductNames = topProducts.slice(0, 3).map(p => p.name).join(', ');
    console.log(`[SurveyMerge] Top products: [${topProductNames}]${topProducts.length > 3 ? '...' : ''}`);
  }

  return topProducts;
}

/**
 * Build context string for AI recommendation step.
 * Combines all Q&A pairs with merged products for the final AI analysis.
 * 
 * @param quesAnses Array of question-answer pairs
 * @param mergedProducts Merged product list from all queries
 * @returns Context string for AI prompt
 */
export function buildSurveyContextForAI(
  quesAnses: Array<{ question: string; answer: string }>,
  mergedProducts: any[]
): string {
  const questionsSection = quesAnses
    .map((qa, index) => `Câu ${index + 1}: ${qa.question}\nTrả lời: ${qa.answer}`)
    .join('\n\n');

  const productsSection = mergedProducts.length > 0
    ? `Danh sách sản phẩm tiềm năng từ tất cả câu hỏi (${mergedProducts.length} sản phẩm):\n${JSON.stringify(mergedProducts, null, 2)}`
    : 'Không tìm thấy sản phẩm phù hợp từ các câu hỏi khảo sát.';

  return `
=== KHẢO SÁT NGƯỜI DÙNG ===
${questionsSection}

=== SẢN PHẨM TIỀM NĂNG ===
${productsSection}
`;
}

/**
 * Check if merge results are valid (at least some products found).
 * 
 * @param results Array of query results
 * @returns true if at least one query returned products
 */
export function hasValidMergeResults(results: SurveyQueryResult[]): boolean {
  return results.some(r => r.products && r.products.length > 0);
}

/**
 * Get merge statistics for logging/debugging.
 * 
 * @param results Array of query results
 * @returns Statistics object
 */
export function getMergeStatistics(results: SurveyQueryResult[]): {
  totalQueries: number;
  queriesWithResults: number;
  uniqueProducts: number;
  productsByScore: Record<number, number>;
} {
  const scoreMap = new Map<number, number>();
  let totalProducts = 0;

  for (const result of results) {
    if (result.products && result.products.length > 0) {
      for (const product of result.products) {
        totalProducts++;
        const currentCount = scoreMap.get(product.score || 1) || 0;
        scoreMap.set(product.score || 1, currentCount + 1);
      }
    }
  }

  return {
    totalQueries: results.length,
    queriesWithResults: results.filter(r => r.products && r.products.length > 0).length,
    uniqueProducts: scoreMap.size,
    productsByScore: Object.fromEntries(scoreMap)
  };
}
