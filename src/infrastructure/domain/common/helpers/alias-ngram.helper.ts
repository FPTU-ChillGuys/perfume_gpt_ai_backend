import { Injectable } from '@nestjs/common';
import {
  EntityDictionary,
  EntityType
} from 'src/domain/types/dictionary.types';

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
  enrichAll(dict: EntityDictionary): void {
    for (const [type, map] of Object.entries(dict)) {
      this.enrichForType(type as EntityType, map);
    }
  }

  private enrichForType(
    entityType: EntityType,
    map: Record<string, string[]>
  ): void {
    const existing = this.buildIndex(map);
    const canonicals = Object.keys(map);

    for (const canonical of canonicals) {
      const words = canonical.split(/\s+/).filter((w) => w.length >= 2);
      if (words.length < 2) continue;

      const subterms = this.extractSubterms(words);
      const newAliases = subterms.filter(
        (st) => !existing.has(st) && !GENERIC_WORDS.has(st) && st.length >= 3
      );

      if (newAliases.length > 0) {
        map[canonical] = Array.from(
          new Set([...(map[canonical] ?? []), ...newAliases])
        );
      }
    }
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
