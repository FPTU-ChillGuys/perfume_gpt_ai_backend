import { Injectable, Logger } from '@nestjs/common';
import { DictionaryBuilderService } from './dictionary-builder.service';
import { EntityDictionary, EntityType } from 'src/domain/types/dictionary.types';
import winkNLP, { CustomEntityExample, WinkMethods } from 'wink-nlp';
import model from 'wink-eng-lite-web-model';
import * as fs from 'fs';
import * as path from 'path';
import { JaroWinklerDistance, NGrams } from 'natural';

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
  'co', 'huong', 'mui', 'nuoc', 'hoa', 'danh', 'cho', 'tren', 'duoi', 'tuoi', 'va', 'hoac',
  'nguoi', 'nam', 'nu', 'la', 'o', 'tai', 'gan', 'khoang',
]);

@Injectable()
export class WinkNlpService {
  private readonly logger = new Logger(WinkNlpService.name);
  private nlp: WinkMethods | null = null;
  private isInitialized = false;
  private patternCache: Map<string, any> = new Map();

  constructor(private readonly dictionaryBuilderService: DictionaryBuilderService) {}

  /**
   * Initialize winkNLP with dictionary patterns
   * Call this on app startup after dictionary is built
   */
  async initializeWithDictionary(): Promise<void> {
    try {
      this.logger.log(`[WinkNLP] Initializing winkNLP...`);

      // Load wink-nlp model
      this.nlp = winkNLP(model);

      // Get dictionary snapshot and build wink patterns
      const snapshot = this.dictionaryBuilderService.getSnapshot();
      if (!snapshot) {
        throw new Error('Dictionary not built yet. Call buildDictionary() on DictionaryBuilderService first.');
      }

      const patterns = this.buildWinkPatterns(snapshot.entityDictionary);
      this.logger.log(`[WinkNLP] Learn ${patterns.length} custom entity patterns...`);
      this.logger.debug(
        `[WinkNLP][init] entityGroups=${patterns.length} sample=${patterns
          .slice(0, 5)
          .map(p => `${p.name}:${p.patterns.length}`)
          .join(', ')}`,
      );

      this.dumpPatternsToFile(patterns);

      // Register patterns with winkNLP
      this.nlp.learnCustomEntities(patterns);
      for (const pattern of patterns) {
        this.patternCache.set(pattern.name, pattern);
      }

      this.isInitialized = true;
      this.logger.log(`[WinkNLP] Initialization complete`);
    } catch (error) {
      this.logger.error(`[WinkNLP] Initialization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Extract entities from text using winkNLP
   * Returns raw output from winkNLP
   */
  extractEntities(text: string): any[] {
    if (!this.isInitialized || !this.nlp) {
      throw new Error('WinkNlpService not initialized. Call initializeWithDictionary() first.');
    }

    try {
      const doc = this.nlp.readDoc(text);
      const entities = doc.customEntities().out();
      return Array.isArray(entities) ? entities : (entities ? [entities] : []);
    } catch (error) {
      this.logger.error(`[WinkNLP] Entity extraction failed: ${error}`);
      return [];
    }
  }

  /**
   * Parse text and normalize to canonical entities using winkNLP + reverse map
   */
  parseAndNormalize(text: string): Record<string, any> {
    if (!this.isInitialized) {
      throw new Error('WinkNlpService not initialized');
    }

    const startedAt = Date.now();

    const snapshot = this.dictionaryBuilderService.getSnapshot();
    if (!snapshot) {
      throw new Error('Dictionary snapshot not available');
    }

    // Stage 1: Normalize input (remove accents + canonical spacing).
    const normalizedText = this.normalizeText(text);
    const normalizedTextWithDiacritics = this.normalizeTextKeepDiacritics(text);
    this.logger.debug(
      `[WinkNLP][stage1.normalize] input="${text}" normalized="${normalizedText}" viNormalized="${normalizedTextWithDiacritics}" chars=${normalizedText.length}`,
    );

    // Stage 2: Extract special signals (price range, logic connectors).
    const signals = this.extractSpecialSignals(normalizedText, normalizedTextWithDiacritics);
    this.logger.debug(
      `[WinkNLP][stage2.signals] operators=${signals.operators.join(',') || 'none'} age=${JSON.stringify(signals.ageRange)} price=${JSON.stringify(signals.priceRange)} consumed=${signals.consumedTerms.join(',') || 'none'}`,
    );

    // Stage 3: Extract raw entities from normalized input via winkNLP.
    const rawEntities = this.extractEntities(normalizedText);
    this.logger.debug(
      `[WinkNLP][stage3.wink] rawCount=${rawEntities.length} rawSample=${JSON.stringify(rawEntities.slice(0, 10))}`,
    );

    // Normalize using reverse map
    const result: Record<string, any> = {
      input: text,
      normalizedInput: normalizedText,
      rawEntities,
      signals,
      normalized: {},
      byType: {},
    };

    const reverseMap = this.buildReverseMap(snapshot.entityDictionary);

    const matchedValues = new Set<string>();

    // Stage 3a: Try winkNLP outputs first.
    for (const entity of rawEntities) {
      const value = this.normalizeText(String(entity));
      if (reverseMap[value]) {
        matchedValues.add(value);
        this.appendNormalizedResult(result, reverseMap[value], String(entity));
      }
    }

    // Stage 4: Fallback exact phrase scan.
    const fallbackMatches = this.findFallbackMatches(normalizedText, snapshot.entityDictionary);
    this.logger.debug(
      `[WinkNLP][stage4.exact] candidates=${fallbackMatches.length} sample=${JSON.stringify(
        fallbackMatches.slice(0, 8).map(m => ({ raw: m.raw, canonical: m.mapping.canonical, type: m.mapping.type, confidence: m.mapping.confidence })),
      )}`,
    );
    for (const match of fallbackMatches) {
      if (!matchedValues.has(match.value)) {
        matchedValues.add(match.value);
        this.appendNormalizedResult(result, match.mapping, match.raw);
      }
    }

    // Stage 5: Fuzzy n-gram recovery for remaining terms.
    const remainingText = this.removeMatchedTermsFromText(
      normalizedText,
      Array.from(matchedValues).concat(signals.consumedTerms),
    );
    const fuzzyMatches = this.findFuzzyNgramMatches(remainingText, reverseMap, 0.92);
    this.logger.debug(
      `[WinkNLP][stage5.fuzzy] remaining="${remainingText}" recovered=${fuzzyMatches.length} sample=${JSON.stringify(
        fuzzyMatches.slice(0, 8).map(m => ({ raw: m.raw, canonical: m.mapping.canonical, type: m.mapping.type, confidence: m.mapping.confidence })),
      )}`,
    );
    for (const match of fuzzyMatches) {
      if (!matchedValues.has(match.value)) {
        matchedValues.add(match.value);
        this.appendNormalizedResult(result, match.mapping, match.raw);
      }
    }

    // Stage 6: Build query logic hints.
    result.logic = this.buildLogicHints(result.byType, signals);

    // Stage 6b: Age phrase/range -> attribute_value mapping (age-focused attributes).
    const ageAttributeMatches = this.resolveAgeToAttributeValues(
      signals.ageRange,
      normalizedText,
      snapshot.entityDictionary,
    );
    for (const ageMatch of ageAttributeMatches) {
      this.appendNormalizedResult(result, ageMatch.mapping, ageMatch.raw);
    }

    if (ageAttributeMatches.length > 0) {
      this.logger.debug(
        `[WinkNLP][stage6b.age-attribute] matched=${JSON.stringify(
          ageAttributeMatches.map(m => ({ raw: m.raw, canonical: m.mapping.canonical })),
        )}`,
      );
      result.logic = this.buildLogicHints(result.byType, signals);
    }
    this.logger.debug(
      `[WinkNLP][stage6.logic] byTypeKeys=${Object.keys(result.byType).join(',') || 'none'} andGroups=${result.logic.andGroups.length} orGroups=${result.logic.orGroups.length}`,
    );

    this.logger.debug(
      `[WinkNLP][parse] input="${text}" normalized="${normalizedText}" raw=${rawEntities.length} exact=${fallbackMatches.length} fuzzy=${fuzzyMatches.length}`,
    );
    this.logger.debug(
      `[WinkNLP][signals] operators=${signals.operators.join(',') || 'none'} price=${JSON.stringify(signals.priceRange)} age=${JSON.stringify(signals.ageRange)} remaining="${remainingText}" tookMs=${Date.now() - startedAt}`,
    );

    return result;
  }

  /**
   * Convert entity-centric dictionary to winkNLP pattern format
   * Input: { entityType: Map<canonical, [synonyms]> }
   * Output: [{ name: entityType, patterns: [...] }]
   */
  private buildWinkPatterns(entityDictionary: EntityDictionary): CustomEntityExample[] {
    const patterns: CustomEntityExample[] = [];

    for (const [entityType, canonicalMap] of Object.entries(entityDictionary)) {
      const termPatterns = new Set<string>();

      // Build one syntax-safe pattern per canonical/synonym.
      // docs: no space inside [], and multi-word phrases must be expressed as multiple bracketed tokens.
      for (const [canonical, synonyms] of Object.entries(canonicalMap)) {
        const allTerms = [canonical, ...synonyms];

        for (const term of allTerms) {
          const patternString = this.buildSingleTermPattern(term);
          if (!patternString) continue;
          termPatterns.add(patternString);
        }
      }

      if (termPatterns.size === 0) continue;

      const orderedPatterns = Array.from(termPatterns).sort((a, b) => {
        const aTokenCount = a.split(' ').length;
        const bTokenCount = b.split(' ').length;

        // More-token phrases first, single-token last.
        if (aTokenCount !== bTokenCount) {
          return bTokenCount - aTokenCount;
        }

        // If same token count, longer phrase first.
        return b.length - a.length;
      });

      patterns.push({
        name: entityType,
        patterns: orderedPatterns,
      });

      this.logger.debug(
        `[WinkNLP] Pattern for ${entityType}: ${termPatterns.size} terms`,
      );
    }

    return patterns;
  }

  private buildSingleTermPattern(term: string): string | null {
    const normalized = this.normalizeText(term);
    if (!normalized) return null;

    const tokens = normalized
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length > 0)
      .filter(token => /^[\p{L}\p{N}]+$/u.test(token))
      .filter(token => token.length >= 2 || /^\d+$/.test(token));

    if (tokens.length === 0) return null;

    return tokens.map(token => `[${token}]`).join(' ');
  }

  private dumpPatternsToFile(patterns: CustomEntityExample[]): void {
    try {
      const outputDir = path.join(process.cwd(), 'docs', 'temp');
      const outputFile = path.join(outputDir, 'winknlp-patterns.txt');

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const lines: string[] = [];
      lines.push(`# winkNLP patterns dump`);
      lines.push(`# generatedAt: ${new Date().toISOString()}`);
      lines.push(`# totalEntityGroups: ${patterns.length}`);
      lines.push('');

      for (const pattern of patterns) {
        lines.push(`## ${pattern.name}`);
        lines.push(`count=${pattern.patterns.length}`);
        for (const p of pattern.patterns) {
          lines.push(String(p));
        }
        lines.push('');
      }

      fs.writeFileSync(outputFile, lines.join('\n'), 'utf8');
      this.logger.log(`[WinkNLP] Pattern dump saved: ${outputFile}`);
    } catch (error) {
      this.logger.error(`[WinkNLP] Failed to dump patterns: ${error}`);
    }
  }

  /**
   * Build reverse mapping: synonym -> { type, canonical, confidence }
   */
  private buildReverseMap(
    entityDictionary: EntityDictionary,
  ): Record<string, { type: EntityType; canonical: string; confidence: number }> {
    const map: Record<
      string,
      { type: EntityType; canonical: string; confidence: number }
    > = {};

    for (const [entityType, canonicalMap] of Object.entries(entityDictionary)) {
      for (const [canonical, synonyms] of Object.entries(canonicalMap)) {
        // Map canonical itself (high confidence)
        map[canonical] = {
          type: entityType as EntityType,
          canonical,
          confidence: 1.0,
        };

        // Map all synonyms (slightly lower confidence)
        for (const syn of synonyms) {
          if (!map[syn]) {
            map[syn] = {
              type: entityType as EntityType,
              canonical,
              confidence: 0.95,
            };
          }
        }
      }
    }

    return map;
  }

  /**
   * Fallback scan: match normalized text against every canonical + synonym in the dictionary.
   * This keeps the test usable even when winkNLP custom entities do not fire.
   */
  private findFallbackMatches(
    normalizedText: string,
    entityDictionary: EntityDictionary,
  ): Array<{
    value: string;
    raw: string;
    mapping: { type: EntityType; canonical: string; confidence: number };
  }> {
    const matches: Array<{
      value: string;
      raw: string;
      mapping: { type: EntityType; canonical: string; confidence: number };
    }> = [];

    for (const [entityType, canonicalMap] of Object.entries(entityDictionary)) {
      for (const [canonical, synonyms] of Object.entries(canonicalMap)) {
        const candidateTerms = [canonical, ...synonyms];

        for (const term of candidateTerms) {
          const normalizedTerm = this.normalizeText(term);
          if (!normalizedTerm) continue;

          // Exact phrase match with word boundaries to avoid accidental substring matches.
          const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const termRegex = new RegExp(`\\b${escaped}\\b`, 'i');
          if (termRegex.test(normalizedText)) {
            matches.push({
              value: normalizedTerm,
              raw: term,
              mapping: {
                type: entityType as EntityType,
                canonical,
                confidence: normalizedTerm === canonical ? 1.0 : 0.9,
              },
            });
          }
        }
      }
    }

    return matches;
  }

  private appendNormalizedResult(
    result: Record<string, any>,
    mapping: Mapping,
    raw: string,
  ) {
    if (!result.normalized[mapping.type]) {
      result.normalized[mapping.type] = [];
    }

    const existed = result.normalized[mapping.type].some(
      (x: { canonical: string }) => x.canonical === mapping.canonical,
    );
    if (existed) {
      return;
    }

    result.normalized[mapping.type].push({
      raw,
      canonical: mapping.canonical,
      confidence: mapping.confidence,
      type: mapping.type,
    });

    if (!result.byType[mapping.type]) {
      result.byType[mapping.type] = [];
    }
    result.byType[mapping.type].push(mapping.canonical);
  }

  private normalizeText(text: string): string {
    return this.normalizeTextNfc(text)
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeTextKeepDiacritics(text: string): string {
    return this.normalizeTextNfc(text)
      .replace(/[^ -\u007F\p{L}\p{N}\s]/gu, ' ')
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

  private extractNoisyPhrases(normalizedTextWithDiacritics: string): string[] {
    if (!normalizedTextWithDiacritics) return [];

    const phraseGroups: Array<{ canonical: string; variants: string[] }> = [
      { canonical: 'co huong', variants: ['co huong', 'có hương'] },
      { canonical: 'mui huong', variants: ['mui huong', 'mùi hương'] },
      { canonical: 'nuoc hoa', variants: ['nuoc hoa', 'nước hoa'] },
      { canonical: 'danh cho', variants: ['danh cho', 'dành cho'] },
    ];

    const found: string[] = [];
    for (const group of phraseGroups) {
      const hit = group.variants.some(variant => {
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

  private extractSpecialSignals(normalizedText: string, normalizedTextWithDiacritics?: string): SpecialSignals {
    const operators: Array<'and' | 'or'> = [];
    const consumedTerms: string[] = [];

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

    const ageRange = this.extractAgeRangeSignal(normalizedText);
    const priceRange = this.extractPriceRangeSignal(normalizedText);
    if (priceRange) {
      consumedTerms.push('gia');
    }

    if (ageRange) {
      consumedTerms.push('tuoi');
    }

    const noisyPhrases = this.extractNoisyPhrases(normalizedTextWithDiacritics ?? normalizedText);
    for (const phrase of noisyPhrases) {
      consumedTerms.push(this.normalizeText(phrase));
    }

    return {
      operators,
      priceRange,
      ageRange,
      consumedTerms: Array.from(new Set(consumedTerms.filter(Boolean))),
    };
  }

  private extractAgeRangeSignal(normalizedText: string): AgeRangeSignal | null {
    // Examples: "tren 25 tuoi", "duoi 30 tuoi", "25 tuoi"
    const above = normalizedText.match(/(?:tren|hon)\s+(\d{1,3})\s*tuoi/);
    const below = normalizedText.match(/(?:duoi|it hon)\s+(\d{1,3})\s*tuoi/);
    const exact = normalizedText.match(/\b(\d{1,3})\s*tuoi\b/);

    const signal: AgeRangeSignal = { confidence: 0.92 };
    let hasSignal = false;

    if (above) {
      const age = Number(above[1]);
      if (age > 0 && age <= 150) {
        signal.minAge = age;
        hasSignal = true;
      }
    }

    if (below) {
      const age = Number(below[1]);
      if (age > 0 && age <= 150) {
        signal.maxAge = age;
        hasSignal = true;
      }
    }

    if (!above && !below && exact) {
      const age = Number(exact[1]);
      if (age > 0 && age <= 150) {
        signal.exactAge = age;
        hasSignal = true;
      }
    }

    return hasSignal ? signal : null;
  }

  private extractPriceRangeSignal(normalizedText: string): PriceRangeSignal | null {
    // Price must have explicit unit/currency context to avoid confusion with age.
    const above = normalizedText.match(/(?:tren|hon)\s+(\d+(?:[.,]\d+)?)\s*(trieu|nghin|ngan|k|m|vnd|dong)\b/);
    const below = normalizedText.match(/(?:duoi|it hon)\s+(\d+(?:[.,]\d+)?)\s*(trieu|nghin|ngan|k|m|vnd|dong)\b/);
    const approx = normalizedText.match(/(?:xap xi|gan gan|khoang|gan)\s+(\d+(?:[.,]\d+)?)\s*(trieu|nghin|ngan|k|m|vnd|dong)\b/);

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
    if (unit === 'm' || unit === 'trieu') return Math.round(n * 1_000_000);
    if (unit === 'k' || unit === 'nghin' || unit === 'ngan') return Math.round(n * 1_000);
    return Math.round(n);
  }

  private removeMatchedTermsFromText(normalizedText: string, consumedTerms: string[]): string {
    let remaining = normalizedText;
    for (const term of consumedTerms) {
      if (!term) continue;
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'g');
      remaining = remaining.replace(regex, ' ');
    }

    return remaining.replace(/\s+/g, ' ').trim();
  }

  private findFuzzyNgramMatches(
    text: string,
    reverseMap: Record<string, Mapping>,
    threshold: number,
  ): Array<{ value: string; raw: string; mapping: Mapping }> {
    if (!text) return [];

    const tokens = text
      .split(/\s+/)
      .filter(Boolean)
      .filter(t => t.length >= 2);
    if (tokens.length === 0) return [];

    const grams = new Set<string>();
    const maxN = Math.min(10, tokens.length);
    for (let n = 2; n <= maxN; n++) {
      const ngrams = n === 1
        ? tokens.map(t => [t])
        : n === 2
          ? NGrams.bigrams(tokens)
          : n === 3
            ? NGrams.trigrams(tokens)
            : this.buildNgrams(tokens, n);
      for (const g of ngrams) {
        grams.add(Array.isArray(g) ? g.join(' ') : String(g));
      }
    }

    const dictionaryTerms = Object.keys(reverseMap).filter(t => t.length >= 4);
    const matches: Array<{ value: string; raw: string; mapping: Mapping }> = [];

    for (const gram of grams) {
      if (this.isGenericFuzzyPhrase(gram)) {
        continue;
      }

      let bestTerm = '';
      let bestScore = 0;

      for (const dictTerm of dictionaryTerms) {
        const score = JaroWinklerDistance(gram, dictTerm, { ignoreCase: true });
        if (score > bestScore) {
          bestScore = score;
          bestTerm = dictTerm;
        }
      }

      if (bestTerm && bestScore >= threshold) {
        if (gram.length < 3) {
          continue;
        }

        // Avoid expanding generic phrase into long unrelated target.
        if (this.isOverExpandedFuzzy(gram, bestTerm)) {
          continue;
        }

        matches.push({
          value: bestTerm,
          raw: gram,
          mapping: {
            ...reverseMap[bestTerm],
            confidence: Math.min(0.98, bestScore),
          },
        });
      }
    }

    // Prioritize longer grams and higher confidence.
    matches.sort((a, b) => {
      const tokenDiff = b.raw.split(' ').length - a.raw.split(' ').length;
      if (tokenDiff !== 0) return tokenDiff;
      return b.mapping.confidence - a.mapping.confidence;
    });

    return matches.slice(0, 10);
  }

  private isGenericFuzzyPhrase(phrase: string): boolean {
    const tokens = phrase.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return true;

    const genericCount = tokens.filter(t => GENERIC_FUZZY_TOKENS.has(t)).length;
    return genericCount === tokens.length;
  }

  private isOverExpandedFuzzy(sourceGram: string, targetTerm: string): boolean {
    const sourceTokens = sourceGram.split(/\s+/).filter(Boolean);
    const targetTokens = targetTerm.split(/\s+/).filter(Boolean);

    if (sourceTokens.length === 0 || targetTokens.length === 0) return true;

    // If target is much longer than source, it's often a noisy expansion.
    if (targetTokens.length - sourceTokens.length >= 2) {
      return true;
    }

    return false;
  }

  private buildNgrams(tokens: string[], n: number): string[][] {
    const out: string[][] = [];
    for (let i = 0; i <= tokens.length - n; i++) {
      out.push(tokens.slice(i, i + n));
    }
    return out;
  }

  private buildLogicHints(byType: Record<string, any>, signals: SpecialSignals): Record<string, any> {
    const andGroups: any[] = [];
    const orGroups: any[] = [];

    for (const [entityType, values] of Object.entries(byType)) {
      const uniqueValues = Array.from(new Set(values));
      if (uniqueValues.length === 0) continue;

      // If OR detected and there are multiple values in same entity type, keep as OR group.
      if (signals.operators.includes('or') && uniqueValues.length > 1) {
        orGroups.push({ entityType, values: uniqueValues });
      } else {
        andGroups.push({ entityType, values: uniqueValues });
      }
    }

    return {
      operators: signals.operators,
      andGroups,
      orGroups,
      priceRange: signals.priceRange,
      ageRange: signals.ageRange,
    };
  }

  private resolveAgeToAttributeValues(
    ageRange: AgeRangeSignal | null,
    normalizedText: string,
    entityDictionary: EntityDictionary,
  ): Array<{ raw: string; mapping: Mapping }> {
    const results: Array<{ raw: string; mapping: Mapping }> = [];
    const attrValues = entityDictionary.attribute_value ?? {};

    if (!ageRange && !normalizedText) {
      return results;
    }

    const normalizedCandidates = Object.keys(attrValues)
      .filter(v => this.looksLikeAgeAttributeValue(v));

    for (const candidate of normalizedCandidates) {
      const range = this.parseAgeRangeFromText(candidate);

      // Keyword-based mapping (no explicit number)
      if (!ageRange) {
        if (this.ageKeywordHit(normalizedText, candidate)) {
          results.push({
            raw: normalizedText,
            mapping: {
              type: 'attribute_value',
              canonical: candidate,
              confidence: 0.9,
            },
          });
        }
        continue;
      }

      // Number/range-based mapping
      const ageProbe = ageRange.exactAge ?? ageRange.minAge ?? ageRange.maxAge;
      if (!ageProbe) continue;

      if (range && ageProbe >= range.min && ageProbe <= range.max) {
        results.push({
          raw: `${ageProbe} tuoi`,
          mapping: {
            type: 'attribute_value',
            canonical: candidate,
            confidence: 0.95,
          },
        });
        continue;
      }

      if (this.ageKeywordHit(normalizedText, candidate)) {
        results.push({
          raw: normalizedText,
          mapping: {
            type: 'attribute_value',
            canonical: candidate,
            confidence: 0.88,
          },
        });
      }
    }

    // Dedup by canonical
    const seen = new Set<string>();
    return results.filter(r => {
      if (seen.has(r.mapping.canonical)) return false;
      seen.add(r.mapping.canonical);
      return true;
    });
  }

  private looksLikeAgeAttributeValue(value: string): boolean {
    return /tuoi|thanh nien|thanh thieu nien|trung nien|nguoi lon|duoi\s*\d+/.test(value);
  }

  private parseAgeRangeFromText(value: string): { min: number; max: number } | null {
    const nums = value.match(/\d{1,3}/g)?.map(Number) ?? [];
    if (nums.length >= 2) {
      const min = Math.min(nums[0], nums[1]);
      const max = Math.max(nums[0], nums[1]);
      if (min >= 0 && max <= 150) return { min, max };
    }

    if (nums.length === 1 && value.includes('duoi')) {
      const max = nums[0];
      if (max <= 150) return { min: 0, max };
    }

    return null;
  }

  private ageKeywordHit(input: string, candidate: string): boolean {
    const keywords = ['thanh nien', 'thanh thieu nien', 'trung nien', 'nguoi lon', 'tuoi tre'];
    const inInput = keywords.find(k => input.includes(k));
    if (!inInput) return false;
    return candidate.includes(inInput) || candidate.includes('tuoi');
  }

  /**
   * Check if service is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get winkNLP instance (for advanced usage)
   */
  getNlpInstance(): any {
    return this.nlp;
  }
}
