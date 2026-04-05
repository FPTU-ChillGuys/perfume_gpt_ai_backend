/**
 * Recommendation utility helper functions
 */

import { Season } from '../recommendation/recommendation-profile.type';

/**
 * Detect current season based on local date
 */
export function detectCurrentSeason(): Season {
  const month = new Date().getMonth() + 1; // 1-12
  // Summer: May-August (5-8)
  return month >= 5 && month <= 8 ? 'summer' : 'winter';
}

/**
 * Categorize price into ranges
 */
export function getPriceRangeLabel(price: number): string {
  if (price < 500_000) return '< 500k';
  if (price < 1_000_000) return '500k-1m';
  if (price < 2_000_000) return '1m-2m';
  if (price < 3_000_000) return '2m-3m';
  return '> 3m';
}

/**
 * Check if product is fresh scented
 */
export function isFreshScent(scentNotes: string[] = []): boolean {
  const freshKeywords = ['citrus', 'aqua', 'fresh', 'ocean', 'light', 'zesty'];
  return scentNotes.some((note) =>
    freshKeywords.some((keyword) =>
      note.toLowerCase().includes(keyword.toLowerCase())
    )
  );
}

/**
 * Check if product is warm scented
 */
export function isWarmScent(scentNotes: string[] = []): boolean {
  const warmKeywords = [
    'warm',
    'spice',
    'vanilla',
    'woody',
    'amber',
    'oriental'
  ];
  return scentNotes.some((note) =>
    warmKeywords.some((keyword) =>
      note.toLowerCase().includes(keyword.toLowerCase())
    )
  );
}

/**
 * Check if product matches young audience
 */
export function isYoungStyle(scentNotes: string[] = []): boolean {
  const youngKeywords = ['fresh', 'playful', 'sporty', 'light', 'fruity'];
  return scentNotes.some((note) =>
    youngKeywords.some((keyword) =>
      note.toLowerCase().includes(keyword.toLowerCase())
    )
  );
}

/**
 * Check if product matches mature audience
 */
export function isMatureStyle(scentNotes: string[] = []): boolean {
  const matureKeywords = [
    'warm',
    'elegant',
    'sophisticated',
    'amber',
    'oriental'
  ];
  return scentNotes.some((note) =>
    matureKeywords.some((keyword) =>
      note.toLowerCase().includes(keyword.toLowerCase())
    )
  );
}

/**
 * Normalize score to 0-100 range
 */
export function normalizeScore(score: number): number {
  return Math.min(100, Math.max(0, score * 100));
}

/**
 * Calculate percentile rank
 */
export function getPercentileRank(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 0;

  const sorted = [...allValues].sort((a, b) => a - b);
  const count = sorted.filter((v) => v <= value).length;

  return (count / allValues.length) * 100;
}

/**
 * Merge two score maps
 */
export function mergeScoreMaps(
  map1: Record<string, number>,
  map2: Record<string, number>
): Record<string, number> {
  const merged = { ...map1 };

  Object.entries(map2).forEach(([key, value]) => {
    merged[key] = (merged[key] || 0) + value;
  });

  return merged;
}

/**
 * Get top N items from a score map
 */
export function getTopItems(
  map: Record<string, number>,
  n: number
): Array<[string, number]> {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

/**
 * Smooth score with exponential decay
 * Older purchases have less weight
 */
export function calculateDecayScore(
  baseScore: number,
  daysOld: number
): number {
  // Decay 10% per 30 days
  const decayFactor = Math.pow(0.9, daysOld / 30);
  return baseScore * decayFactor;
}
