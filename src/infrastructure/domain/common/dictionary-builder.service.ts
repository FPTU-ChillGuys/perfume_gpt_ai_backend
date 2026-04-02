import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MasterDataService } from './master-data.service';
import {
  EntityDictionary,
  EntityType,
  NumericPattern,
  NumericFieldType,
  ParsedEntity,
  DictionarySnapshot,
  SynonymCanonicalMap,
} from 'src/domain/types/dictionary.types';

@Injectable()
export class DictionaryBuilderService {
  private readonly logger = new Logger(DictionaryBuilderService.name);
  private entityDictionary: EntityDictionary | null = null;
  private numericPatterns: Map<NumericFieldType, NumericPattern> | null = null;
  private synonymCanonicalMap: SynonymCanonicalMap | null = null;
  private lastBuiltAt: Date | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly masterDataService: MasterDataService,
  ) {}

  /**
   * Build dictionary from master data + cache in memory
   * Call this on app startup via onModuleInit hook
   */
  async buildDictionary(): Promise<DictionarySnapshot> {
    this.logger.log(`[DictionaryBuilder] Starting dictionary build...`);
    const startTime = Date.now();

    try {
      // Fetch all master data (no filters, full dataset)
      const [brands, categories, concentrations, families, notes, attributes, products, productVariants] = await Promise.all([
        this.prisma.brands.findMany(),
        this.prisma.categories.findMany(),
        this.prisma.concentrations.findMany(),
        this.prisma.olfactoryFamilies.findMany(),
        this.prisma.scentNotes.findMany(),
        this.prisma.attributes.findMany({ include: { AttributeValues: true } }),
        this.prisma.products.findMany({
          include: {
            ProductFamilyMaps: true,
            ProductNoteMaps: true,
            ProductAttributes: true,
          },
        }),
        this.prisma.productVariants.findMany(),
      ]);

      // Build entity dictionary (entity type -> Map<canonical -> synonyms>)
      const dict: EntityDictionary = {
        brand: this.buildEntityGroup(brands.map(b => ({ id: b.Id, name: b.Name }))),
        category: this.buildEntityGroup(categories.map(c => ({ id: c.Id, name: c.Name }))),
        concentration: this.buildEntityGroup(concentrations.map(c => ({ id: c.Id, name: c.Name }))),
        olfactory_family: this.buildEntityGroup(families.map(f => ({ id: f.Id, name: f.Name }))),
        scent_note: this.buildEntityGroup(notes.map(n => ({ id: n.Id, name: n.Name }))),
        product_name: this.buildEntityGroup(products.map(p => ({ id: p.Id, name: p.Name }))),
        gender: this.buildEntityGroup(
          [...new Set(products.map(p => p.Gender).filter(g => !!g))].map((g, i) => ({
            id: i,
            name: g!,
          })),
        ),
        origin: this.buildEntityGroup(
          [...new Set(products.map(p => p.Origin).filter(o => !!o))].map((o, i) => ({
            id: i,
            name: o!,
          })),
        ),
        attribute_category: this.buildEntityGroup(attributes.map(a => ({ id: a.Id, name: a.Name }))),
        attribute_value: this.buildEntityGroup(
          attributes.flatMap(a =>
            a.AttributeValues.map(av => ({
              id: av.Id,
              name: av.Value,
            })),
          ),
        ),
        variant_type: this.buildEntityGroup(
          [...new Set(productVariants.map(v => v.Type).filter(t => !!t))].map((t, i) => ({
            id: i,
            name: t!,
          })),
        ),
        note_type: this.buildEntityGroup(
          products.flatMap(p =>
            p.ProductNoteMaps.map(pnm => ({
              id: pnm.Id,
              name: pnm.NoteType,
            })),
          ),
        ),
      };

      // Build numeric patterns (hybrid: winkNLP entities + regex constraints)
      const numPatterns = this.buildNumericPatterns(productVariants, products);

      // Build reverse map for post-processing
      const reverseMap = this.buildSynonymCanonicalMap(dict);

      // Store in memory
      this.entityDictionary = dict;
      this.numericPatterns = numPatterns;
      this.synonymCanonicalMap = reverseMap;
      this.lastBuiltAt = new Date();

      // Compute stats
      const stats = this.computeStats(dict);

      const elapsed = Date.now() - startTime;
      this.logger.log(
        `[DictionaryBuilder] Build complete in ${elapsed}ms. ` +
          `Total canonicals: ${stats.totalCanonicals}, Total synonyms: ${stats.totalSynonyms}`,
      );

      return { entityDictionary: dict, numericPatterns: numPatterns, stats };
    } catch (error) {
      this.logger.error(`[DictionaryBuilder] Build failed: ${error}`);
      throw error;
    }
  }

  /**
   * Build entity group from list of items
   * Converts to Map<canonical -> synonyms>
   * Canonical = normalized name, synonyms = variations (lowercase, no accents, common abbreviations)
   */
  private buildEntityGroup(
    items: { id: any; name: string }[],
  ): Record<string, string[]> {
    const map: Record<string, string[]> = {};

    for (const item of items) {
      if (!item.name || item.name.trim().length === 0) continue;

      const canonical = this.normalizeText(item.name);
      const synonyms = new Set<string>();

      // Add original + lowercased
      synonyms.add(item.name.toLowerCase());

      // Add normalized version
      synonyms.add(canonical);

      // Add common abbreviations for specific types
      const abbrev = this.generateAbbreviations(item.name);
      abbrev.forEach(a => synonyms.add(a));

      // Remove canonical from synonyms (avoid duplication)
      synonyms.delete(canonical);

      // Store
      if (!map[canonical]) {
        map[canonical] = Array.from(synonyms);
      }
    }

    return map;
  }

  /**
   * Build numeric patterns (hybrid: winkNLP + regex domain)
   */
  private buildNumericPatterns(
    productVariants: any[],
    products: any[],
  ): Map<NumericFieldType, NumericPattern> {
    const patterns = new Map<NumericFieldType, NumericPattern>();

    // Base price pattern
    patterns.set('price', {
      fieldType: 'price',
      regex: /\b(\d+(?:\.\d{2})?)\s*(?:vnd|₫|\$|usd)?\b/gi,
      unit: 'vnd',
      constraints: {
        min: 50,
        max: 100000000,
      },
    });

    // Retail price (optional, similar to base price)
    patterns.set('retail_price', {
      fieldType: 'retail_price',
      regex: /retail[:\s]+(\d+(?:\.\d{2})?)/gi,
      unit: 'vnd',
    });

    // Volume (ml)
    // Extract observed volumes from db as whitelist
    const observedVolumes = [...new Set(productVariants.map(v => v.VolumeMl).filter(x => x > 0))];
    const volumeWhitelist = [5, 10, 15, 20, 30, 50, 75, 100, 125, 150, 200, 250];
    patterns.set('volume_ml', {
      fieldType: 'volume_ml',
      regex: /\b(\d+)\s*(?:ml|milliliter|mL)?\b/gi,
      unit: 'ml',
      constraints: {
        min: 1,
        max: 1000,
      },
    });

    // Release year (constrain to 1950-2030)
    patterns.set('release_year', {
      fieldType: 'release_year',
      regex: /(?:release|launched|year)[:\s]+(19\d{2}|20\d{2})/gi,
      constraints: {
        min: 1950,
        max: 2030,
      },
    });

    // Longevity score (0-10)
    patterns.set('longevity', {
      fieldType: 'longevity',
      regex: /longevity[:\s]+(\d+)/gi,
      constraints: {
        min: 0,
        max: 10,
      },
    });

    // Sillage score (0-10)
    patterns.set('sillage', {
      fieldType: 'sillage',
      regex: /sillage[:\s]+(\d+)/gi,
      constraints: {
        min: 0,
        max: 10,
      },
    });

    this.logger.debug(`[DictionaryBuilder] Built ${patterns.size} numeric patterns`);
    return patterns;
  }

  /**
   * Build reverse mapping: synonym -> { type, canonical, confidence }
   */
  private buildSynonymCanonicalMap(dict: EntityDictionary): SynonymCanonicalMap {
    const map: SynonymCanonicalMap = {};

    for (const [entityType, canonicalMap] of Object.entries(dict)) {
      for (const [canonical, synonyms] of Object.entries(canonicalMap)) {
        // Map canonical itself
        map[canonical] = {
          type: entityType as EntityType,
          canonical,
          confidence: 1.0,
        };

        // Map all synonyms
        for (const syn of synonyms) {
          if (!map[syn]) {
            map[syn] = {
              type: entityType as EntityType,
              canonical,
              confidence: 0.95, // Slightly less confident for synonyms
            };
          }
        }
      }
    }

    this.logger.debug(`[DictionaryBuilder] Built reverse map with ${Object.keys(map).length} entries`);
    return map;
  }

  /**
   * Normalize text: lowercase, trim, remove accents (for Vietnamese)
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
  }

  /**
   * Generate common abbreviations
   * e.g., "Eau de Parfum" -> ["eau de parfum", "edp", "eaude parfum"]
   */
  private generateAbbreviations(text: string): string[] {
    const abbrevs: string[] = [];
    const lower = text.toLowerCase();

    // Common perfume abbreviations
    if (lower.includes('eau de parfum')) {
      abbrevs.push('edp', 'eau de parfum');
    }
    if (lower.includes('eau de toilette')) {
      abbrevs.push('edt', 'eau de toilette');
    }
    if (lower.includes('eau de cologne')) {
      abbrevs.push('edc', 'eau de cologne');
    }

    // First letters of multi-word names
    const words = lower.split(/\s+/);
    if (words.length > 1) {
      abbrevs.push(words.map(w => w[0]).join(''));
    }

    return abbrevs;
  }

  /**
   * Compute statistics for dictionary snapshot
   */
  private computeStats(dict: EntityDictionary) {
    const stats = {
      totalCanonicals: 0,
      totalSynonyms: 0,
      entityBreakdown: {} as Record<EntityType, { canonicals: number; synonyms: number }>,
      timestamp: new Date(),
    };

    for (const [entityType, canonicalMap] of Object.entries(dict)) {
      let canonicals = Object.keys(canonicalMap).length;
      let synonyms = 0;

      for (const syns of Object.values(canonicalMap)) {
        synonyms += syns.length;
      }

      stats.totalCanonicals += canonicals;
      stats.totalSynonyms += synonyms;
      stats.entityBreakdown[entityType as EntityType] = { canonicals, synonyms };
    }

    return stats;
  }

  /**
   * Get current dictionary snapshot (for inspection/testing)
   */
  getSnapshot(): DictionarySnapshot | null {
    if (!this.entityDictionary || !this.numericPatterns) {
      return null;
    }

    return {
      entityDictionary: this.entityDictionary,
      numericPatterns: this.numericPatterns,
      stats: {
        totalCanonicals: Object.values(this.entityDictionary).reduce(
          (sum, m) => sum + Object.keys(m).length,
          0,
        ),
        totalSynonyms: Object.values(this.entityDictionary).reduce(
          (sum, m) => sum + Object.values(m).reduce((s, syns) => s + syns.length, 0),
          0,
        ),
        entityBreakdown: this.computeEntityBreakdown(),
        timestamp: this.lastBuiltAt!,
      },
    };
  }

  /**
   * Parse keywords using dictionary + winkNLP
   * Returns structured entities with canonical mappings
   */
  async parseKeywords(text: string): Promise<ParsedEntity[]> {
    if (!this.entityDictionary || !this.synonymCanonicalMap) {
      throw new Error('Dictionary not initialized. Call buildDictionary() first.');
    }

    const entities: ParsedEntity[] = [];

    // Simple tokenization for now (improved by winkNLP integration in next step)
    const tokens = this.tokenizeText(text);

    for (const token of tokens) {
      const lower = token.toLowerCase();

      // Check exact match in reverse map
      if (this.synonymCanonicalMap[lower]) {
        const mapping = this.synonymCanonicalMap[lower];
        entities.push({
          raw: token,
          type: mapping.type,
          canonicalValue: mapping.canonical,
          confidence: mapping.confidence,
          source: 'exact_match',
        });
        continue;
      }

      // Check numeric patterns
      for (const [fieldType, pattern] of Object.entries(this.numericPatterns || {})) {
        const match = text.match(pattern.regex);
        if (match && match[1]) {
          const num = parseFloat(match[1]);
          if (this.validateNumericValue(num, pattern)) {
            entities.push({
              raw: match[0],
               type: fieldType as NumericFieldType,
              normalizedValue: num,
              confidence: 0.9,
              source: 'numeric_pattern',
              metadata: { unit: pattern.unit },
            });
          }
        }
      }
    }

    return entities;
  }

  /**
   * Validate numeric value against constraints
   */
  private validateNumericValue(value: number, pattern: NumericPattern): boolean {
    if (!pattern.constraints) return true;
    if (pattern.constraints.min !== undefined && value < pattern.constraints.min) return false;
    if (pattern.constraints.max !== undefined && value > pattern.constraints.max) return false;
    return true;
  }

  /**
   * Simple tokenization (will be enhanced with winkNLP)
   */
  private tokenizeText(text: string): string[] {
    return text
      .split(/[\s,;.!?]+/)
      .filter(t => t.length > 0);
  }

  /**
   * Compute entity breakdown for stats
   */
  private computeEntityBreakdown(): Record<EntityType, { canonicals: number; synonyms: number }> {
    const breakdown: Record<EntityType, { canonicals: number; synonyms: number }> = {
      brand: { canonicals: 0, synonyms: 0 },
      category: { canonicals: 0, synonyms: 0 },
      concentration: { canonicals: 0, synonyms: 0 },
      olfactory_family: { canonicals: 0, synonyms: 0 },
      scent_note: { canonicals: 0, synonyms: 0 },
      attribute_category: { canonicals: 0, synonyms: 0 },
      attribute_value: { canonicals: 0, synonyms: 0 },
      product_name: { canonicals: 0, synonyms: 0 },
      gender: { canonicals: 0, synonyms: 0 },
      origin: { canonicals: 0, synonyms: 0 },
      variant_type: { canonicals: 0, synonyms: 0 },
      note_type: { canonicals: 0, synonyms: 0 },
    };

    for (const [entityType, canonicalMap] of Object.entries(this.entityDictionary || {})) {
      const key = entityType as EntityType;
      breakdown[key].canonicals = Object.keys(canonicalMap).length;
      breakdown[key].synonyms = Object.values(canonicalMap).reduce(
        (sum, syns) => sum + syns.length,
        0,
      );
    }

    return breakdown;
  }
}
