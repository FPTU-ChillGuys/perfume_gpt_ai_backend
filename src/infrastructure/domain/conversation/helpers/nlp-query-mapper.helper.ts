import { Injectable, Logger } from '@nestjs/common';
import { NlpEngineService } from 'src/infrastructure/domain/common/nlp-engine.service';
import { QueryItemObject } from 'src/chatbot/output/analysis.output';

type NlpParseResult = {
  byType: Record<string, string[]>;
  signals: {
    operators: Array<'and' | 'or'>;
    priceRange: {
      minPriceVnd?: number;
      maxPriceVnd?: number;
      approxPriceVnd?: number;
      confidence: number;
    } | null;
    ageRange: {
      minAge?: number;
      maxAge?: number;
      exactAge?: number;
      confidence: number;
    } | null;
  };
  logic: {
    operators: Array<'and' | 'or'>;
    andGroups: Array<{ entityType: string; values: string[] }>;
    orGroups: Array<{ entityType: string; values: string[] }>;
    priceRange: unknown;
    ageRange: unknown;
  };
};

const SEARCH_INTENTS = ['Search', 'Consult', 'Recommend', 'Compare'];

@Injectable()
export class NlpQueryMapper {
  private readonly logger = new Logger(NlpQueryMapper.name);

  constructor(private readonly nlpEngineService: NlpEngineService) {}

  mapToQueries(text: string, intent: string): QueryItemObject[] | null {
    if (!SEARCH_INTENTS.includes(intent)) {
      return null;
    }

    if (!this.nlpEngineService.isReady()) {
      this.logger.warn('[NlpQueryMapper] NLP engine not ready, skipping');
      return null;
    }

    let parseResult: Record<string, any>;
    try {
      parseResult = this.nlpEngineService.parseAndNormalize(text);
    } catch (err) {
      this.logger.warn(
        `[NlpQueryMapper] NLP parse failed: ${(err as Error).message}`
      );
      return null;
    }

    const result = parseResult as NlpParseResult;
    const byType = result.byType ?? {};
    const logic = result.logic;
    const signals = result.signals;

    const hasEntities = Object.keys(byType).length > 0;
    const hasPriceRange = !!signals?.priceRange;
    const hasAnyData = hasEntities || hasPriceRange;

    if (!hasAnyData) {
      this.logger.debug(
        '[NlpQueryMapper] No entities or signals found, skipping'
      );
      return null;
    }

    const query = this.buildSearchQuery(byType, logic, signals);
    if (!query) {
      return null;
    }

    this.logger.log(
      `[NlpQueryMapper] Mapped "${text.substring(0, 50)}" → logic: ${JSON.stringify(query.logic)}, budget: ${JSON.stringify(query.budget)}`
    );

    return [query];
  }

  mergeQueries(
    aiQueries: QueryItemObject[] | null,
    nlpQueries: QueryItemObject[] | null
  ): QueryItemObject[] | null {
    if (!aiQueries && !nlpQueries) return null;
    if (!aiQueries) return nlpQueries;
    if (!nlpQueries) return aiQueries;

    const merged = [...aiQueries];
    for (const nlpQuery of nlpQueries) {
      if (nlpQuery.purpose !== 'search') continue;

      const existingSearchIdx = merged.findIndex((q) => q.purpose === 'search');
      if (existingSearchIdx >= 0) {
        merged[existingSearchIdx] = this.unionSearchQueries(
          merged[existingSearchIdx],
          nlpQuery
        );
      } else {
        merged.push(nlpQuery);
      }
    }

    return merged;
  }

  private buildSearchQuery(
    byType: Record<string, string[]>,
    logic: NlpParseResult['logic'],
    signals: NlpParseResult['signals']
  ): QueryItemObject | null {
    const logicGroups: (string | string[])[] = [];

    if (logic?.andGroups && logic.andGroups.length > 0) {
      for (const group of logic.andGroups) {
        const dedupedValues = Array.from(new Set(group.values));
        if (dedupedValues.length > 0) {
          logicGroups.push(
            dedupedValues.length === 1 ? dedupedValues[0] : dedupedValues
          );
        }
      }
    } else {
      for (const [entityType, values] of Object.entries(byType)) {
        const dedupedValues = Array.from(new Set(values));
        if (dedupedValues.length > 0) {
          logicGroups.push(
            dedupedValues.length === 1 ? dedupedValues[0] : dedupedValues
          );
        }
      }
    }

    if (logic?.orGroups && logic.orGroups.length > 0) {
      for (const group of logic.orGroups) {
        const dedupedValues = Array.from(new Set(group.values));
        if (dedupedValues.length > 0) {
          logicGroups.push(
            dedupedValues.length === 1 ? dedupedValues[0] : dedupedValues
          );
        }
      }
    }

    if (logicGroups.length === 0 && !signals?.priceRange) {
      return null;
    }

    let budget: { min: number | null; max: number | null } | null = null;
    if (signals?.priceRange) {
      const pr = signals.priceRange;
      if (pr.minPriceVnd || pr.maxPriceVnd || pr.approxPriceVnd) {
        budget = {
          min: pr.minPriceVnd ?? null,
          max: pr.maxPriceVnd ?? pr.approxPriceVnd ?? null
        };
      }
    }

    return {
      purpose: 'search',
      logic: logicGroups.length > 0 ? logicGroups : null,
      productNames: this.extractProductNames(byType),
      sorting: null,
      budget,
      functionCall: null,
      profileHint: null
    };
  }

  private extractProductNames(
    byType: Record<string, string[]>
  ): string[] | null {
    const productNames = byType['product_name'] ?? byType['brand'] ?? [];
    if (productNames.length === 0) return null;
    return Array.from(new Set(productNames)).slice(0, 8);
  }

  private unionSearchQueries(
    ai: QueryItemObject,
    nlp: QueryItemObject
  ): QueryItemObject {
    const mergedLogic: (string | string[])[] = [];

    const aiLogic = ai.logic ?? [];
    const nlpLogic = nlp.logic ?? [];
    const seenKeywords = new Set<string>();
    for (const group of [...aiLogic, ...nlpLogic]) {
      if (typeof group === 'string') {
        if (!seenKeywords.has(group.toLowerCase())) {
          mergedLogic.push(group);
          seenKeywords.add(group.toLowerCase());
        }
      } else if (Array.isArray(group)) {
        const filtered = group.filter(
          (k) => !seenKeywords.has(k.toLowerCase())
        );
        if (filtered.length > 0) {
          mergedLogic.push(filtered.length === 1 ? filtered[0] : filtered);
          filtered.forEach((k) => seenKeywords.add(k.toLowerCase()));
        }
      }
    }

    const aiNames = ai.productNames ?? [];
    const nlpNames = nlp.productNames ?? [];
    const mergedNames = Array.from(new Set([...aiNames, ...nlpNames])).slice(
      0,
      8
    );

    const mergedBudget = ai.budget ?? nlp.budget;

    return {
      purpose: 'search',
      logic: mergedLogic.length > 0 ? mergedLogic : null,
      productNames: mergedNames.length > 0 ? mergedNames : null,
      sorting: ai.sorting,
      budget: mergedBudget,
      functionCall: null,
      profileHint: ai.profileHint ?? nlp.profileHint
    };
  }
}
