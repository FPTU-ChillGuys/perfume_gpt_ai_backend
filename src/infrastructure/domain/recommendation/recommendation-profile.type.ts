/**
 * Type definitions for recommendation system — V3 internal types only.
 * Domain DTOs have been moved to src/application/dtos/response/recommendation/
 */

export type Season = 'summer' | 'winter';
export type RecommendationMode = 'cold-start' | 'warm-user' | 'hybrid';

export interface ScoresWeights {
  brand: number;
  scent: number;
  survey: number;
  season: number;
  age: number;
  budget: number;
}

const DEFAULT_WEIGHTS: ScoresWeights = {
  brand: 0.25,
  scent: 0.4,
  survey: 0.1,
  season: 0.12,
  age: 0.08,
  budget: 0.05
};

export { DEFAULT_WEIGHTS };
