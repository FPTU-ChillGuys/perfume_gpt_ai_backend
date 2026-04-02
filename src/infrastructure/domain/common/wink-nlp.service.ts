import { Injectable, Logger } from '@nestjs/common';
import { DictionaryBuilderService } from './dictionary-builder.service';
import { EntityDictionary, EntityType, SynonymCanonicalMap } from 'src/domain/types/dictionary.types';
import winkNLP, { CustomEntityExample, WinkMethods } from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

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
      const its = this.nlp.its;
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

    const snapshot = this.dictionaryBuilderService.getSnapshot();
    if (!snapshot) {
      throw new Error('Dictionary snapshot not available');
    }

    // Normalize input first so accented Vietnamese input can match ASCII-safe patterns.
    const normalizedText = this.normalizeText(text);

    // Extract raw entities from normalized input.
    const rawEntities = this.extractEntities(normalizedText);

    // Normalize using reverse map
    const result: Record<string, any> = {
      input: text,
      normalizedInput: normalizedText,
      rawEntities,
      normalized: {},
      byType: {},
    };

    const reverseMap = this.buildReverseMap(snapshot.entityDictionary);

    const matchedValues = new Set<string>();

    // 1) Try winkNLP outputs first
    for (const entity of rawEntities) {
      const value = this.normalizeText(String(entity));
      if (reverseMap[value]) {
        matchedValues.add(value);
        this.appendNormalizedResult(result, reverseMap[value], String(entity));
      }
    }

    // 2) Fallback: scan dictionary by token/phrase if winkNLP returns nothing
    if (matchedValues.size === 0) {
      const fallbackMatches = this.findFallbackMatches(normalizedText, snapshot.entityDictionary);
      for (const match of fallbackMatches) {
        if (!matchedValues.has(match.value)) {
          matchedValues.add(match.value);
          this.appendNormalizedResult(result, match.mapping, match.raw);
        }
      }
    }

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
      .filter(token => /^[a-z0-9]+$/.test(token));

    if (tokens.length === 0) return null;

    return tokens.map(token => `[${token}]`).join(' ');
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

          // Exact phrase match in normalized text
          if (normalizedText.includes(normalizedTerm)) {
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
    mapping: { type: EntityType; canonical: string; confidence: number },
    raw: string,
  ) {
    if (!result.normalized[mapping.type]) {
      result.normalized[mapping.type] = [];
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
    return text
      .toLowerCase()
      .trim()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đ]/g, 'd')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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
