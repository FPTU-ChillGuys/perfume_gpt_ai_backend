/**
 * Type definitions for recommendation system
 */

export type Season = 'summer' | 'winter';
export type RecommendationMode = 'cold-start' | 'warm-user' | 'hybrid';

export interface RecommendationProfile {
  userId: string;

  recommendationMode: RecommendationMode;
  
  // Age & Demographics
  dynamicAge: number;
  gender?: string;
  
  // Preferences from purchase history (last 2 years)
  topBrands: string[];
  topScents: string[];
  topGenders: string[];
  topOccasions: string[];
  topPriceRanges: string[];
  
  // Budget information
  monthlyBudgetAvg: number;
  minBudgetMonthly: number;
  maxBudgetMonthly: number;
  
  // Seasonality
  currentSeason: Season;
  
  // Survey preferences
  surveyTopScents: string[];
  surveyTopOccasions: string[];
  surveyTopStyles: string[];
  
  // Purchase frequency patterns
  repurchaseFrequencyMap: Record<string, number>; // productId -> days
}

export interface ProductScore {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  brand?: string;
  basePrice?: number;
  gender?: string;
  scentNotes?: string[];
  score: number;
  
  // Score breakdown for transparency
  scoreBreakdown: {
    brandScore: number;
    scentScore: number;
    surveyScore: number;
    seasonScore: number;
    ageScore: number;
    budgetScore: number;
    repurchaseBonus: number;
  };
  
  // Diversification aids
  olfactoryFamilies?: string[];
  
  // Additional metadata
  isRepurchaseCandidate: boolean;
  repurchaseDaysRemaining?: number;
}

export interface RecommendationResponse {
  userId: string;
  recommendations: ProductScore[];
  totalProducts: number;
  profile: {
    dynamicAge: number;
    currentSeason: Season;
    monthlyBudgetAvg: number;
    topBrands: string[];
    topScents: string[];
  };
}

export interface ProductVariantInfo {
  variantId: string;
  productId: string;
  productName: string;
  variantName?: string;
  brand?: string;
  gender?: string;
  basePrice?: number;
  volumeMl?: number;
  concentration?: string;
  scentNotes?: string[];
  olfactoryFamilies?: string[];
  priceRange?: string;
}

export interface OrderWithProducts {
  orderId: string;
  customerId: string;
  createdAt: Date;
  totalAmount: number;
  orderDetails: Array<{
    quantity: number;
    unitPrice: number;
    productVariant: {
      id: string;
      VolumeMl: number;
      BasePrice: number;
      Products?: {
        Id: string;
        Name: string;
        Brands?: {
          Name: string;
        };
        Gender?: string;
        ProductFamilyMaps?: Array<{
          OlfactoryFamilies?: {
            Name: string;
          };
        }>;
        ProductNoteMaps?: Array<{
          ScentNotes?: {
            Name: string;
          };
        }>;
      };
    };
  }>;
}

// ==========================================
// V3 TYPES: SIMPLE & PRACTICAL
// ==========================================

export interface RecommendationProfileV3 {
  topBrands: string[];
  topScents: string[];
  avgPrice: number;
  budgetRange: [number, number]; // [min, max]
  age: number;
}

export interface ProductScoreV3 {
  productId: string;
  variantId: string;
  productName: string;
  brand?: string;
  basePrice?: number;
  scentNotes?: string[];
  score: number;
  
  // Simplified breakdown for V3
  scoreBreakdown: {
    brandScore: number;
    scentScore: number;
    budgetScore: number;
    seasonScore: number;
  };
}

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
  scent: 0.40, // Merge survey weight into hard purchase history
  survey: 0.10, // Weak signal
  season: 0.12,
  age: 0.08,
  budget: 0.05
};

export { DEFAULT_WEIGHTS };
