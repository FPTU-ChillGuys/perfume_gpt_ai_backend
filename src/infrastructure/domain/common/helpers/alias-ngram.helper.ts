import { Injectable, Logger } from '@nestjs/common';
import {
  EntityDictionary,
  EntityType
} from 'src/domain/types/dictionary.types';
import { PromptLoaderService } from 'src/infrastructure/domain/utils/prompt-loader.service';

const GENERIC_WORDS = new Set([
  'cho',
  'the',
  'and',
  'for',
  'co',
  'có',
  'la',
  'là',
  'o',
  'ở',
  'tai',
  'tại',
  'hang',
  'hàng',
  'loai',
  'loại',
  'lo',
  'nhãn',
  'nhan',
  'san',
  'sản',
  'nuoc',
  'nước',
  'hoa',
  'mui',
  'mùi',
  'huong',
  'hương',
  'nam',
  'nam',
  'nu',
  'nữ',
  'nam',
  'nữ'
]);

@Injectable()
export class AliasNgramHelper {
  private readonly logger = new Logger(AliasNgramHelper.name);

  constructor(private readonly promptLoader: PromptLoaderService) {}

  enrichAll(dict: EntityDictionary): void {
    for (const [type, map] of Object.entries(dict)) {
      this.enrichForType(type as EntityType, map);
    }

    let totalAliases = 0;
    let typeCount = 0;
    for (const map of Object.values(dict)) {
      for (const aliases of Object.values(map)) {
        totalAliases += aliases.length;
        typeCount++;
      }
    }
    this.logger.log(
      this.promptLoader.get('log.alias_enrich.ngram.summary', {
        TOTAL: String(totalAliases),
        TYPES: String(typeCount)
      })
    );
  }

  private enrichForType(
    entityType: EntityType,
    map: Record<string, string[]>
  ): void {
    const existing = this.buildIndex(map);
    const canonicals = Object.keys(map);

    let totalSubterms = 0;
    const originalCount = Object.values(map).reduce(
      (sum, a) => sum + a.length,
      0
    );

    for (const canonical of canonicals) {
      const words = canonical.split(/\s+/).filter((w) => w.length >= 2);
      if (words.length < 2) continue;

      const subterms = this.extractSubterms(words);
      totalSubterms += subterms.length;
      const newAliases = subterms.filter(
        (st) => !existing.has(st) && !GENERIC_WORDS.has(st) && st.length >= 3
      );

      if (newAliases.length > 0) {
        const added = newAliases.length;
        map[canonical] = Array.from(
          new Set([...(map[canonical] ?? []), ...newAliases])
        );
        this.logger.debug(
          this.promptLoader.get('log.alias_enrich.ngram.detail', {
            ENTITY_TYPE: entityType,
            CANONICAL: canonical,
            COUNT: String(added),
            LIST: newAliases.join(', ')
          })
        );
      }
    }

    const finalCount = Object.values(map).reduce(
      (sum, a) => sum + a.length,
      0
    );
    const aliasAdded = finalCount - originalCount;
    this.logger.log(
      this.promptLoader.get('log.alias_enrich.ngram.type', {
        ENTITY_TYPE: entityType,
        ALIASES: String(aliasAdded),
        SUBTERMS: String(totalSubterms)
      })
    );
  }

  private buildIndex(map: Record<string, string[]>): Set<string> {
    const index = new Set<string>();
    for (const [canonical, aliases] of Object.entries(map)) {
      index.add(canonical);
      for (const a of aliases) {
        index.add(a);
      }
    }
    return index;
  }

  private extractSubterms(words: string[]): string[] {
    const result = new Set<string>();

    // Single-word subterms (last word preferred)
    for (let i = 0; i < words.length; i++) {
      result.add(words[i]);
    }

    // Bi-grams
    for (let i = 0; i < words.length - 1; i++) {
      result.add(`${words[i]} ${words[i + 1]}`);
    }

    // Tri-grams
    for (let i = 0; i < words.length - 2; i++) {
      result.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }

    // Last N words (2..N)
    for (let n = 2; n <= words.length; n++) {
      const phrase = words.slice(-n).join(' ');
      result.add(phrase);
    }

    return Array.from(result);
  }
}