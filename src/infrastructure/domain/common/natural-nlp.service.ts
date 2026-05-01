import { Injectable, Logger, Optional } from '@nestjs/common';
import { WordTokenizer, JaroWinklerDistance, NGrams } from 'natural';
import { DictionaryBuilderService } from './dictionary-builder.service';
import {
  AgeBucketSnapshot,
  EntityDictionary,
  EntityType,
  ParserRuleSnapshot,
  PhraseRuleSnapshot
} from 'src/domain/types/dictionary.types';
import { VocabBm25SearchService } from './vocab-bm25.service';
import { VocabBm25Result } from 'src/application/dtos/response/dictionary/vocab-bm25-result';

type Mapping = { type: EntityType; canonical: string; confidence: number };

type PriceRangeSignal = {
  minPriceVnd?: number;
  maxPriceVnd?: number;
  approxPriceVnd?: number;
  confidence: number;
};

type AgeRangeSignal = {
  minAge?: number;
  maxAge?: number;
  exactAge?: number;
  confidence: number;
};

type SpecialSignals = {
  operators: Array<'and' | 'or'>;
  priceRange: PriceRangeSignal | null;
  ageRange: AgeRangeSignal | null;
  consumedTerms: string[];
};

const GENERIC_FUZZY_TOKENS = new Set([
  'co',
  'huong',
  'mui',
  'nuoc',
  'hoa',
  'danh',
  'cho',
  'tren',
  'duoi',
  'tuoi',
  'va',
  'hoac',
  'nguoi',
  'nam',
  'nu',
  'la',
  'o',
  'tai',
  'gan',
  'khoang'
]);

@Injectable()
export class NaturalNlpService {
  private readonly logger = new Logger(NaturalNlpService.name);
  private readonly tokenizer = new WordTokenizer();
  private isInitialized = false;

  constructor(
    private readonly dictionaryBuilderService: DictionaryBuilderService,
    @Optional() private readonly vocabBm25SearchService?: VocabBm25SearchService
  ) {}

  async initializeWithDictionary(): Promise<void> {
    const snapshot = this.dictionaryBuilderService.getSnapshot();
    if (!snapshot) {
      throw new Error(
        'Dictionary not built yet. Call buildDictionary() on DictionaryBuilderService first.'
      );
    }

    this.isInitialized = true;
    this.logger.log('[NaturalNLP] Initialized with dictionary snapshot');
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  private async findBm25Matches(
    remainingText: string,
    matchedValues: Set<string>,
    reverseMap: Record<
      string,
      { type: EntityType; canonical: string; confidence: number }
    >
  ): Promise<Array<{ value: string; raw: string; mapping: Mapping }>> {
    if (!this.vocabBm25SearchService) {
      return [];
    }

    try {
      const tokens = this.tokenizer.tokenize(remainingText);
      const matches: Array<{ value: string; raw: string; mapping: Mapping }> =
        [];
      const seenCanonicals = new Set<string>();

      for (const token of tokens) {
        if (!token || token.length < 2) continue;
        if (GENERIC_FUZZY_TOKENS.has(token)) continue;
        if (reverseMap[token]) continue;

        const results = await this.vocabBm25SearchService.search(token, 3);
        for (const result of results) {
          if (
            matchedValues.has(result.canonical) ||
            seenCanonicals.has(result.canonical)
          ) {
            continue;
          }

          const validEntityTypes: EntityType[] = [
            'brand',
            'category',
            'concentration',
            'olfactory_family',
            'scent_note',
            'attribute_category',
            'attribute_value',
            'product_name',
            'gender',
            'origin',
            'variant_type'
          ];

          if (!validEntityTypes.includes(result.entityType)) {
            continue;
          }

          seenCanonicals.add(result.canonical);
          matches.push({
            value: result.canonical,
            raw: result.canonical,
            mapping: {
              type: result.entityType,
              canonical: result.canonical,
              confidence: Math.min(0.98, 0.9 + result.score)
            }
          });

          if (seenCanonicals.size >= 5) break;
        }

        if (seenCanonicals.size >= 5) break;
      }

      return matches;
    } catch (error) {
      this.logger.warn(
        `[NaturalNLP] BM25 search failed: ${(error as Error).message}`
      );
      return [];
    }
  }

  extractEntities(text: string): string[] {
    if (!this.isInitialized) {
      throw new Error(
        'NaturalNlpService not initialized. Call initializeWithDictionary() first.'
      );
    }

    const snapshot = this.dictionaryBuilderService.getSnapshot();
    if (!snapshot) return [];

    const normalized = this.normalizeText(text);
    const reverseMap = this.buildReverseMap(snapshot.entityDictionary);

    const tokens = this.tokenizer.tokenize(normalized);
    const found = new Set<string>();

    for (let size = Math.min(4, tokens.length); size >= 1; size--) {
      const grams = NGrams.ngrams(tokens, size);
      for (const gram of grams) {
        const phrase = gram.join(' ').trim();
        if (!phrase) continue;
        if (reverseMap[phrase]) found.add(phrase);
      }
    }

    return Array.from(found);
  }

  async parseAndNormalize(text: string): Promise<Record<string, any>> {
    if (!this.isInitialized) {
      throw new Error('NaturalNlpService not initialized');
    }

    const snapshot = this.dictionaryBuilderService.getSnapshot();
    if (!snapshot) {
      throw new Error('Dictionary snapshot not available');
    }

    const normalizedText = this.normalizeText(text);
    const normalizedTextWithDiacritics = this.normalizeTextKeepDiacritics(text);
    const signals = this.extractSpecialSignals(
      normalizedText,
      normalizedTextWithDiacritics,
      snapshot.phraseRules ?? []
    );

    const rawEntities = this.extractEntities(normalizedText);

    const result: Record<string, any> = {
      input: text,
      normalizedInput: normalizedText,
      rawEntities,
      signals,
      normalized: {},
      byType: {}
    };

    const reverseMap = this.buildReverseMap(snapshot.entityDictionary);
    const matchedValues = new Set<string>();

    for (const entity of rawEntities) {
      const value = this.normalizeText(String(entity));
      if (reverseMap[value]) {
        matchedValues.add(value);
        this.appendNormalizedResult(result, reverseMap[value], String(entity));
      }
    }

    const fallbackMatches = this.findFallbackMatches(
      normalizedText,
      snapshot.entityDictionary
    );
    for (const match of fallbackMatches) {
      if (!matchedValues.has(match.value)) {
        matchedValues.add(match.value);
        this.appendNormalizedResult(result, match.mapping, match.raw);
      }
    }

    const remainingText = this.removeMatchedTermsFromText(
      normalizedText,
      Array.from(matchedValues).concat(signals.consumedTerms)
    );

    const bm25Matches = await this.findBm25Matches(
      remainingText,
      matchedValues,
      reverseMap
    );
    for (const match of bm25Matches) {
      if (!matchedValues.has(match.value)) {
        matchedValues.add(match.value);
        this.appendNormalizedResult(result, match.mapping, match.raw);
      }
    }

    const fuzzyMatches = this.findFuzzyNgramMatches(
      remainingText,
      reverseMap,
      0.92
    );
    for (const match of fuzzyMatches) {
      if (!matchedValues.has(match.value)) {
        matchedValues.add(match.value);
        this.appendNormalizedResult(result, match.mapping, match.raw);
      }
    }

    const productNameMatches = this.findProductNameSubsetMatches(
      remainingText,
      snapshot.entityDictionary.product_name ?? {}
    );
    for (const match of productNameMatches) {
      if (!matchedValues.has(match.value)) {
        matchedValues.add(match.value);
        this.appendNormalizedResult(result, match.mapping, match.raw);
      }
    }

    result.logic = this.buildLogicHints(result.byType, signals);

    const ageAttributeMatches = this.resolveAgeToAttributeValues(
      signals.ageRange,
      normalizedText,
      snapshot.entityDictionary,
      snapshot.ageBuckets ?? []
    );

    for (const ageMatch of ageAttributeMatches) {
      this.appendNormalizedResult(result, ageMatch.mapping, ageMatch.raw);
    }

    if (ageAttributeMatches.length > 0) {
      result.logic = this.buildLogicHints(result.byType, signals);
    }

    this.pruneAgeAttributeNoise(result, signals, snapshot.parserRules ?? []);
    result.logic = this.buildLogicHints(result.byType, signals);

    return result;
  }

  private pruneAgeAttributeNoise(
    result: Record<string, any>,
    signals: SpecialSignals,
    parserRules: ParserRuleSnapshot[]
  ): void {
    const hasPriceSignal = !!signals.priceRange;
    const hasAgeSignal = !!signals.ageRange;
    if (!hasPriceSignal || hasAgeSignal) {
      return;
    }

    const normalizedAttr = Array.isArray(result.normalized?.attribute_value)
      ? result.normalized.attribute_value
      : [];

    const filteredNormalized = normalizedAttr.filter(
      (entry: { canonical?: string }) => {
        const canonical =
          typeof entry?.canonical === 'string' ? entry.canonical : '';
        return !this.looksLikeAgeAttributeValue(canonical, parserRules);
      }
    );

    if (filteredNormalized.length > 0) {
      result.normalized.attribute_value = filteredNormalized;
    } else if (result.normalized && result.normalized.attribute_value) {
      delete result.normalized.attribute_value;
    }

    const byTypeAttr = Array.isArray(result.byType?.attribute_value)
      ? result.byType.attribute_value
      : [];
    const filteredByType = byTypeAttr.filter(
      (canonical: string) =>
        !this.looksLikeAgeAttributeValue(canonical, parserRules)
    );

    if (filteredByType.length > 0) {
      result.byType.attribute_value = filteredByType;
    } else if (result.byType && result.byType.attribute_value) {
      delete result.byType.attribute_value;
    }
  }

  private looksLikeAgeAttributeValue(
    value: string,
    parserRules: ParserRuleSnapshot[]
  ): boolean {
    const normalized = this.normalizeTextForSignals(value);
    if (!normalized) {
      return false;
    }

    const ageRules = parserRules
      .filter((rule) => rule.ruleGroup === 'age_attribute_value')
      .sort((a, b) => b.priority - a.priority);

    if (ageRules.length === 0) {
      if (
        /(tuoi|thanh nien|nguoi lon|trung nien|thieu nien|teen)/.test(
          normalized
        )
      ) {
        return true;
      }
      if (/(duoi|tren|tu)\s*\d{1,3}/.test(normalized)) {
        return true;
      }
      return /\d{1,3}\s*(?:-|den)\s*\d{1,3}/.test(normalized);
    }

    for (const rule of ageRules) {
      if (!rule.pattern) {
        continue;
      }

      if (rule.isRegex) {
        try {
          if (new RegExp(rule.pattern, 'i').test(normalized)) {
            return true;
          }
        } catch {
          continue;
        }
      } else {
        const normalizedPattern = this.normalizeTextForSignals(rule.pattern);
        if (normalizedPattern && normalized.includes(normalizedPattern)) {
          return true;
        }
      }
    }

    return false;
  }

  private buildReverseMap(
    entityDictionary: EntityDictionary
  ): Record<
    string,
    { type: EntityType; canonical: string; confidence: number }
  > {
    const map: Record<
      string,
      { type: EntityType; canonical: string; confidence: number }
    > = {};

    for (const [entityType, canonicalMap] of Object.entries(entityDictionary)) {
      for (const [canonical, synonyms] of Object.entries(canonicalMap)) {
        map[canonical] = {
          type: entityType as EntityType,
          canonical,
          confidence: 1.0
        };

        for (const syn of synonyms) {
          if (!map[syn]) {
            map[syn] = {
              type: entityType as EntityType,
              canonical,
              confidence: 0.95
            };
          }
        }
      }
    }

    return map;
  }

  private findFallbackMatches(
    normalizedText: string,
    entityDictionary: EntityDictionary
  ): Array<{ value: string; raw: string; mapping: Mapping }> {
    const matches: Array<{ value: string; raw: string; mapping: Mapping }> = [];

    for (const [entityType, canonicalMap] of Object.entries(entityDictionary)) {
      for (const [canonical, synonyms] of Object.entries(canonicalMap)) {
        const candidateTerms = [canonical, ...synonyms];

        for (const term of candidateTerms) {
          const normalizedTerm = this.normalizeText(term);
          if (!normalizedTerm) continue;

          const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const termRegex = new RegExp(`\\b${escaped}\\b`, 'i');
          if (termRegex.test(normalizedText)) {
            matches.push({
              value: normalizedTerm,
              raw: term,
              mapping: {
                type: entityType as EntityType,
                canonical,
                confidence: normalizedTerm === canonical ? 1.0 : 0.9
              }
            });
          }
        }
      }
    }

    return matches;
  }

  private findProductNameSubsetMatches(
    remainingText: string,
    productNameMap: Record<string, string[]>
  ): Array<{ value: string; raw: string; mapping: Mapping }> {
    const matches: Array<{ value: string; raw: string; mapping: Mapping }> = [];
    const queryTokens = this.tokenizeForSubsetMatching(remainingText);

    if (queryTokens.length < 2) {
      return matches;
    }

    for (const [canonical, synonyms] of Object.entries(productNameMap)) {
      const candidateTerms = [canonical, ...synonyms];

      let bestCoverage = 0;
      for (const term of candidateTerms) {
        const termTokens = this.tokenizeForSubsetMatching(term);
        if (termTokens.length === 0) {
          continue;
        }

        const common = queryTokens.filter((token) =>
          termTokens.includes(token)
        ).length;
        const coverage = common / queryTokens.length;
        if (coverage > bestCoverage) {
          bestCoverage = coverage;
        }
      }

      if (bestCoverage >= 0.66) {
        matches.push({
          value: canonical,
          raw: remainingText,
          mapping: {
            type: 'product_name',
            canonical,
            confidence: Math.min(0.98, 0.9 + bestCoverage * 0.08)
          }
        });
      }
    }

    matches.sort((a, b) => b.mapping.confidence - a.mapping.confidence);
    return matches.slice(0, 3);
  }

  private tokenizeForSubsetMatching(text: string): string[] {
    return this.normalizeText(text)
      .split(/\s+/)
      .filter((token) => token.length >= 3)
      .filter((token) => !GENERIC_FUZZY_TOKENS.has(token));
  }

  private findFuzzyNgramMatches(
    remainingText: string,
    reverseMap: Record<
      string,
      { type: EntityType; canonical: string; confidence: number }
    >,
    threshold: number
  ): Array<{ value: string; raw: string; mapping: Mapping }> {
    const matches: Array<{ value: string; raw: string; mapping: Mapping }> = [];
    const candidates = Object.keys(reverseMap);
    if (!remainingText || candidates.length === 0) return matches;

    const tokens = remainingText.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return matches;

    for (let size = Math.min(4, tokens.length); size >= 1; size--) {
      const grams = NGrams.ngrams(tokens, size).map((g) => g.join(' '));

      for (const gram of grams) {
        if (!gram) continue;

        const normalizedGram = this.normalizeText(gram);
        if (!normalizedGram) continue;

        if (
          size === 1 &&
          (normalizedGram.length <= 2 ||
            GENERIC_FUZZY_TOKENS.has(normalizedGram))
        ) {
          continue;
        }

        let best: { candidate: string; score: number } | null = null;

        for (const candidate of candidates) {
          const score = JaroWinklerDistance(normalizedGram, candidate);
          if (score < threshold) continue;

          if (!best || score > best.score) {
            best = { candidate, score };
          }
        }

        if (best) {
          const mapping = reverseMap[best.candidate];
          matches.push({
            value: best.candidate,
            raw: gram,
            mapping: {
              type: mapping.type,
              canonical: mapping.canonical,
              confidence: Math.min(
                0.98,
                Math.max(mapping.confidence, best.score)
              )
            }
          });
        }
      }
    }

    return matches;
  }

  private removeMatchedTermsFromText(text: string, terms: string[]): string {
    let updated = text;
    for (const term of terms) {
      if (!term) continue;
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      updated = updated.replace(regex, ' ');
    }

    return updated.replace(/\s+/g, ' ').trim();
  }

  private appendNormalizedResult(
    result: Record<string, any>,
    mapping: Mapping,
    raw: string
  ) {
    if (!result.normalized[mapping.type]) {
      result.normalized[mapping.type] = [];
    }

    const existed = result.normalized[mapping.type].some(
      (x: { canonical: string }) => x.canonical === mapping.canonical
    );
    if (existed) return;

    result.normalized[mapping.type].push({
      raw,
      canonical: mapping.canonical,
      confidence: mapping.confidence,
      type: mapping.type
    });

    if (!result.byType[mapping.type]) {
      result.byType[mapping.type] = [];
    }
    if (!result.byType[mapping.type].includes(mapping.canonical)) {
      result.byType[mapping.type].push(mapping.canonical);
    }
  }

  private buildLogicHints(
    byType: Record<string, string[]>,
    signals: SpecialSignals
  ) {
    const andGroups = Object.entries(byType)
      .filter(([, values]) => values.length > 0)
      .map(([entityType, values]) => ({
        entityType,
        values: Array.from(new Set(values))
      }));

    return {
      operators: signals.operators,
      andGroups,
      orGroups: [],
      priceRange: signals.priceRange,
      ageRange: signals.ageRange
    };
  }

  private resolveAgeToAttributeValues(
    ageRange: AgeRangeSignal | null,
    normalizedText: string,
    entityDictionary: EntityDictionary,
    ageBuckets: AgeBucketSnapshot[]
  ): Array<{ raw: string; mapping: Mapping }> {
    const results: Array<{ raw: string; mapping: Mapping }> = [];
    const attrValues = entityDictionary.attribute_value ?? {};

    const matchingBuckets = this.findMatchingAgeBuckets(
      normalizedText,
      ageRange,
      ageBuckets
    );
    if (matchingBuckets.length === 0) {
      return results;
    }

    for (const bucket of matchingBuckets) {
      const bucketLabel = this.normalizeText(bucket.label);
      const canonical = this.findAttributeValueCanonicalByLabel(
        bucketLabel,
        attrValues
      );
      if (!canonical) {
        continue;
      }

      if (results.some((entry) => entry.mapping.canonical === canonical)) {
        continue;
      }

      results.push({
        raw: bucket.label,
        mapping: { type: 'attribute_value', canonical, confidence: 0.95 }
      });
    }

    return results;
  }

  private findMatchingAgeBuckets(
    normalizedText: string,
    ageRange: AgeRangeSignal | null,
    ageBuckets: AgeBucketSnapshot[]
  ): AgeBucketSnapshot[] {
    const runtimeBuckets =
      ageBuckets.length > 0
        ? ageBuckets
        : this.deriveAgeBucketsFromAttributeValues(
            this.dictionaryBuilderService.getSnapshot()?.entityDictionary
          );

    if (!runtimeBuckets.length) {
      return [];
    }

    const normalizedBuckets = runtimeBuckets
      .filter((bucket) => bucket.label && bucket.label.trim().length > 0)
      .map((bucket) => ({
        bucket,
        normalizedLabel: this.normalizeText(bucket.label)
      }))
      .filter((entry) => entry.normalizedLabel.length > 0);

    const directLabelMatches = normalizedBuckets
      .filter(({ normalizedLabel }) =>
        this.containsWholePhrase(normalizedText, normalizedLabel)
      )
      .map(({ bucket }) => bucket);

    if (directLabelMatches.length > 0) {
      return this.sortAgeBuckets(directLabelMatches);
    }

    if (!ageRange) {
      return [];
    }

    const rangeMatches = normalizedBuckets
      .filter(({ bucket }) => this.doesAgeRangeOverlapBucket(ageRange, bucket))
      .map(({ bucket }) => bucket);

    return this.sortAgeBuckets(rangeMatches);
  }

  private deriveAgeBucketsFromAttributeValues(
    entityDictionary?: EntityDictionary
  ): AgeBucketSnapshot[] {
    const attrValues = entityDictionary?.attribute_value ?? {};
    const buckets: AgeBucketSnapshot[] = [];

    for (const canonical of Object.keys(attrValues)) {
      const normalized = this.normalizeTextForSignals(canonical);
      const digits = normalized.match(/\d{1,3}/g)?.map(Number) ?? [];

      if (digits.length >= 2) {
        const minAge = Math.min(digits[0], digits[1]);
        const maxAge = Math.max(digits[0], digits[1]);
        buckets.push({
          label: canonical,
          minAge,
          maxAge,
          priority: Math.max(1, maxAge - minAge)
        });
        continue;
      }

      if (digits.length === 1) {
        const age = digits[0];
        if (/duoi|nho hon/.test(normalized)) {
          buckets.push({
            label: canonical,
            minAge: 0,
            maxAge: age,
            priority: age
          });
          continue;
        }
        if (/tren|hon|tu\s+\d+/.test(normalized)) {
          buckets.push({
            label: canonical,
            minAge: age,
            maxAge: 150,
            priority: age
          });
        }
      }
    }

    return buckets;
  }

  private doesAgeRangeOverlapBucket(
    ageRange: AgeRangeSignal,
    bucket: AgeBucketSnapshot
  ): boolean {
    if (ageRange.exactAge !== undefined) {
      return (
        ageRange.exactAge >= bucket.minAge && ageRange.exactAge <= bucket.maxAge
      );
    }

    const min = ageRange.minAge ?? Number.NEGATIVE_INFINITY;
    const max = ageRange.maxAge ?? Number.POSITIVE_INFINITY;
    return bucket.maxAge >= min && bucket.minAge <= max;
  }

  private sortAgeBuckets(buckets: AgeBucketSnapshot[]): AgeBucketSnapshot[] {
    return [...buckets].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      if (a.minAge !== b.minAge) {
        return a.minAge - b.minAge;
      }

      return a.maxAge - b.maxAge;
    });
  }

  private findAttributeValueCanonicalByLabel(
    bucketLabel: string,
    attributeValues: Record<string, string[]>
  ): string | null {
    for (const [canonical, synonyms] of Object.entries(attributeValues)) {
      if (this.normalizeText(canonical) === bucketLabel) {
        return canonical;
      }

      if (
        synonyms.some((synonym) => this.normalizeText(synonym) === bucketLabel)
      ) {
        return canonical;
      }
    }

    return null;
  }

  private containsWholePhrase(text: string, phrase: string): boolean {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(text);
  }

  private extractSpecialSignals(
    normalizedText: string,
    normalizedTextWithDiacritics?: string,
    phraseRules: PhraseRuleSnapshot[] = []
  ): SpecialSignals {
    const operators: Array<'and' | 'or'> = [];
    const consumedTerms: string[] = [];
    const signalText = this.normalizeTextForSignals(
      normalizedTextWithDiacritics ?? normalizedText
    );

    const tokens = normalizedText.split(/\s+/);
    for (const token of tokens) {
      if (token === 'va' || token === 'and') {
        operators.push('and');
        consumedTerms.push(token);
      }
      if (token === 'hoac' || token === 'or') {
        operators.push('or');
        consumedTerms.push(token);
      }
    }

    const ageRange = this.extractAgeRangeSignal(signalText);
    const priceRange = this.extractPriceRangeSignal(signalText);

    if (priceRange) {
      consumedTerms.push('gia');
    }
    if (ageRange) {
      consumedTerms.push('tuoi');
    }

    const noisyPhrases = this.extractNoisyPhrases(
      normalizedTextWithDiacritics ?? normalizedText,
      phraseRules
    );
    for (const phrase of noisyPhrases) {
      consumedTerms.push(this.normalizeText(phrase));
    }

    return {
      operators,
      priceRange,
      ageRange,
      consumedTerms: Array.from(new Set(consumedTerms))
    };
  }

  private extractNoisyPhrases(
    normalizedTextWithDiacritics: string,
    phraseRules: PhraseRuleSnapshot[] = []
  ): string[] {
    if (!normalizedTextWithDiacritics) return [];

    if (phraseRules.length > 0) {
      const found: string[] = [];
      for (const rule of phraseRules) {
        if (rule.ruleType !== 'consume') continue;
        const escaped = rule.normalizedPhrase.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&'
        );
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (regex.test(normalizedTextWithDiacritics)) {
          found.push(rule.normalizedPhrase);
        }
      }
      return found;
    }

    const phraseGroups: Array<{ canonical: string; variants: string[] }> = [
      { canonical: 'co huong', variants: ['co huong', 'có hương'] },
      { canonical: 'mui huong', variants: ['mui huong', 'mùi hương'] },
      { canonical: 'nuoc hoa', variants: ['nuoc hoa', 'nước hoa'] },
      { canonical: 'danh cho', variants: ['danh cho', 'dành cho'] }
    ];

    const found: string[] = [];
    for (const group of phraseGroups) {
      const hit = group.variants.some((variant) => {
        const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        return regex.test(normalizedTextWithDiacritics);
      });

      if (hit) {
        found.push(group.canonical);
      }
    }

    return found;
  }

  private extractPriceRangeSignal(
    normalizedText: string
  ): PriceRangeSignal | null {
    if (/tuoi/.test(normalizedText)) {
      return null;
    }

    const above = normalizedText.match(
      /(?:tren|hon)\s+(\d+(?:[.,]\d+)?)\s*(trieu|nghin|ngan|k|m|vnd|dong)\b/i
    );
    const below = normalizedText.match(
      /(?:duoi|it hon|nho hon)\s+(\d+(?:[.,]\d+)?)\s*(trieu|nghin|ngan|k|m|vnd|dong)\b/i
    );
    const approx = normalizedText.match(
      /(?:xap xi|gan gan|khoang|gan)\s+(\d+(?:[.,]\d+)?)\s*(trieu|nghin|ngan|k|m|vnd|dong)\b/i
    );
    const between = normalizedText.match(
      /tu\s+(\d+(?:[.,]\d+)?)\s*(trieu|nghin|ngan|k|m|vnd|dong)?\s+den\s+(\d+(?:[.,]\d+)?)\s*(trieu|nghin|ngan|k|m|vnd|dong)?\b/i
    );

    if (between) {
      const leftUnit = between[2] || between[4] || 'vnd';
      const rightUnit = between[4] || between[2] || 'vnd';
      const left = this.toVndNumber(between[1], leftUnit);
      const right = this.toVndNumber(between[3], rightUnit);
      return {
        minPriceVnd: Math.min(left, right),
        maxPriceVnd: Math.max(left, right),
        confidence: 0.95
      };
    }

    if (!above && !below && !approx) {
      return null;
    }

    const signal: PriceRangeSignal = { confidence: 0.9 };

    if (above) {
      signal.minPriceVnd = this.toVndNumber(above[1], above[2]);
    }
    if (below) {
      signal.maxPriceVnd = this.toVndNumber(below[1], below[2]);
    }
    if (approx) {
      signal.approxPriceVnd = this.toVndNumber(approx[1], approx[2]);
    }

    return signal;
  }

  private toVndNumber(rawNumber: string, unit?: string): number {
    const n = Number(rawNumber.replace(',', '.'));
    if (Number.isNaN(n)) return 0;

    if (!unit) return Math.round(n);
    const u = unit.toLowerCase();
    if (u === 'm' || u === 'trieu') return Math.round(n * 1_000_000);
    if (u === 'k' || u === 'nghin' || u === 'ngan')
      return Math.round(n * 1_000);
    return Math.round(n);
  }

  private extractAgeRangeSignal(normalizedText: string): AgeRangeSignal | null {
    const exact = normalizedText.match(/\b(\d{1,2})\s*tuoi\b/i);
    const min = normalizedText.match(/(?:tren|tu\s+)(\d{1,2})\s*tuoi\b/i);
    const max = normalizedText.match(
      /(?:duoi|nho\s+hon)\s*(\d{1,2})\s*tuoi\b/i
    );

    if (min?.[1]) {
      return { minAge: Number(min[1]), confidence: 0.92 };
    }

    if (max?.[1]) {
      return { maxAge: Number(max[1]), confidence: 0.92 };
    }

    if (exact?.[1]) {
      return { exactAge: Number(exact[1]), confidence: 0.9 };
    }

    return null;
  }

  private normalizeTextForSignals(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeText(text: string): string {
    return this.normalizeTextNfc(text)
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeTextKeepDiacritics(text: string): string {
    return this.normalizeTextNfc(text)
      .replace(/[^\u0000-\u007F\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeTextNfc(text: string): string {
    return text
      .normalize('NFC')
      .toLowerCase()
      .replace(/[\s\-]+/g, ' ')
      .trim();
  }
}
