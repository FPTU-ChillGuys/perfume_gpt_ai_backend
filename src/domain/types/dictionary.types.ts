/**
 * Dictionary types for winkNLP entity recognition
 * Entity-centric structure supporting string + numeric patterns
 */

export type EntityType =
  | 'brand'
  | 'category'
  | 'concentration'
  | 'olfactory_family'
  | 'scent_note'
  | 'attribute_category'
  | 'attribute_value'
  | 'product_name'
  | 'gender'
  | 'origin'
  | 'variant_type';

export type NumericFieldType =
  | 'price'
  | 'retail_price'
  | 'volume_ml'
  | 'release_year'
  | 'longevity'
  | 'sillage';

export interface AgeBucketSnapshot {
  label: string;
  minAge: number;
  maxAge: number;
  priority: number;
}

export interface ParserRuleSnapshot {
  ruleGroup: string;
  pattern: string;
  isRegex: boolean;
  priority: number;
}

export interface PhraseRuleSnapshot {
  phrase: string;
  normalizedPhrase: string;
  ruleType: string;
  scope: string;
  confidence: number;
}

/**
 * Entity-centric dictionary structure:
 * Key: entity type
 * Value: map của canonical -> [synonyms]
 */
export type EntityDictionary = Record<
  EntityType,
  Record<string, string[]> // canonical -> [synonym1, synonym2, ...]
>;

/**
 * Numeric pattern specification for hybrid parsing
 */
export interface NumericPattern {
  fieldType: NumericFieldType;
  regex: RegExp;
  unit?: string; // e.g., 'ml', 'vnd', null
  constraints?: {
    min?: number;
    max?: number;
    mustIncludeUnit?: boolean;
  };
}

/**
 * Parsed entity from winkNLP + post-processing
 */
export interface ParsedEntity {
  raw: string;
  type: EntityType | NumericFieldType;
  canonicalValue?: string;
  normalizedValue?: string | number;
  confidence: number; // 0-1
  source: 'exact_match' | 'fuzzy_match' | 'numeric_pattern';
  metadata?: Record<string, any>;
}

/**
 * Dictionary builder output snapshot
 */
export interface DictionarySnapshot {
  entityDictionary: EntityDictionary;
  numericPatterns: Map<NumericFieldType, NumericPattern>;
  ageBuckets?: AgeBucketSnapshot[];
  parserRules?: ParserRuleSnapshot[];
  phraseRules?: PhraseRuleSnapshot[];
  stats: {
    totalCanonicals: number;
    totalSynonyms: number;
    entityBreakdown: Record<
      EntityType,
      { canonicals: number; synonyms: number }
    >;
    timestamp: Date;
  };
}

/**
 * winkNLP custom entity pattern
 */
export interface WinkEntityPattern {
  name: string;
  patterns: string[] | RegExp;
}

/**
 * Reverse mapping: synonym -> canonical (for post-processing)
 */
export type SynonymCanonicalMap = Record<
  string,
  {
    type: EntityType;
    canonical: string;
    confidence: number;
  }
>;
