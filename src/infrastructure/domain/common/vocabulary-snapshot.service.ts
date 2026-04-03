import { MikroORM } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { DictionarySnapshot, EntityDictionary, NumericFieldType, NumericPattern } from 'src/domain/types/dictionary.types';
import { VocabAgeBucket } from 'src/domain/entities/vocab/vocab-age-bucket.entity';
import { VocabAlias } from 'src/domain/entities/vocab/vocab-alias.entity';
import { VocabDictionary } from 'src/domain/entities/vocab/vocab-dictionary.entity';
import { VocabPhraseRule } from 'src/domain/entities/vocab/vocab-phrase-rule.entity';
import { VocabTerm } from 'src/domain/entities/vocab/vocab-term.entity';

type SerializedNumericPattern = Omit<NumericPattern, 'regex'> & {
  regex: { source: string; flags: string };
};

type SerializedSnapshotPayload = {
  entityDictionary: EntityDictionary;
  numericPatterns: Array<[NumericFieldType, SerializedNumericPattern]>;
  stats: DictionarySnapshot['stats'];
};

@Injectable()
export class VocabularySnapshotService {
  private readonly logger = new Logger(VocabularySnapshotService.name);

  constructor(private readonly orm: MikroORM) {}

  async persistSnapshot(snapshot: DictionarySnapshot, source: string): Promise<VocabDictionary> {
    const em = this.orm.em.fork() as EntityManager;
    return em.transactional(async em => {
      await em.nativeUpdate(VocabDictionary, { isActive: true }, { isActive: false, status: 'archived' });

      const version = this.buildVersion(snapshot);
      const vocabDictionary = em.create(VocabDictionary, {
        version,
        source,
        status: 'active',
        isActive: true,
        builtAt: snapshot.stats.timestamp,
        stats: snapshot.stats as unknown as Record<string, unknown>,
        snapshotPayload: this.serializeSnapshot(snapshot),
      } as any);

      em.persist(vocabDictionary);
      await em.flush();

      const terms: VocabTerm[] = [];
      const aliases: VocabAlias[] = [];
      const ageBuckets: VocabAgeBucket[] = [];
      const phraseRules: VocabPhraseRule[] = [];

      for (const [entityType, canonicalMap] of Object.entries(snapshot.entityDictionary)) {
        for (const [canonical, synonyms] of Object.entries(canonicalMap)) {
          const term = em.create(VocabTerm, {
            dictionary: vocabDictionary,
            entityType,
            canonical,
            normalizedCanonical: this.normalizeText(canonical),
            priority: this.computePriority(canonical),
            confidence: 1,
          } as any);
          terms.push(term);

          for (const synonym of synonyms) {
            aliases.push(
              em.create(VocabAlias, {
                term,
                aliasText: synonym,
                normalizedAlias: this.normalizeText(synonym),
                confidence: 0.95,
                aliasKind: 'synonym',
              } as any),
            );
          }

          if (entityType === 'attribute_value') {
            const bucket = this.tryBuildAgeBucket(term, canonical);
            if (bucket) {
              ageBuckets.push(em.create(VocabAgeBucket, bucket as any));
            }
          }
        }
      }

      for (const phrase of this.buildPhraseRules()) {
        phraseRules.push(
          em.create(VocabPhraseRule, {
            dictionary: vocabDictionary,
            phrase,
            normalizedPhrase: this.normalizeText(phrase),
            ruleType: 'consume',
            scope: 'global',
            confidence: 1,
          } as any),
        );
      }

      em.persist([...terms, ...aliases, ...ageBuckets, ...phraseRules]);
      await em.flush();

      this.logger.log(
        `[VocabularySnapshot] Persisted ${version} with ${terms.length} terms, ${aliases.length} aliases, ${ageBuckets.length} age buckets, ${phraseRules.length} phrase rules`,
      );

      return vocabDictionary;
    });
  }

  async loadActiveSnapshot(): Promise<DictionarySnapshot | null> {
    const em = this.orm.em.fork() as EntityManager;
    const dictionary = await em.findOne(VocabDictionary, { isActive: true }, { orderBy: { builtAt: 'DESC' } });
    if (!dictionary?.snapshotPayload) {
      return null;
    }

    return this.deserializeSnapshot(dictionary.snapshotPayload as unknown as SerializedSnapshotPayload);
  }

  private serializeSnapshot(snapshot: DictionarySnapshot): SerializedSnapshotPayload {
    return {
      entityDictionary: snapshot.entityDictionary,
      numericPatterns: Array.from(snapshot.numericPatterns.entries()).map(([fieldType, pattern]) => [
        fieldType,
        {
          ...pattern,
          regex: {
            source: pattern.regex.source,
            flags: pattern.regex.flags,
          },
        },
      ]),
      stats: snapshot.stats,
    };
  }

  private deserializeSnapshot(payload: SerializedSnapshotPayload): DictionarySnapshot {
    const numericPatterns = new Map<NumericFieldType, NumericPattern>(
      payload.numericPatterns.map(([fieldType, pattern]) => [
        fieldType,
        {
          ...pattern,
          regex: new RegExp(pattern.regex.source, pattern.regex.flags),
        },
      ]),
    );

    return {
      entityDictionary: payload.entityDictionary,
      numericPatterns,
      stats: {
        ...payload.stats,
        timestamp: payload.stats.timestamp instanceof Date
          ? payload.stats.timestamp
          : new Date(payload.stats.timestamp as unknown as string),
      },
    };
  }

  private buildVersion(snapshot: DictionarySnapshot): string {
    return `vocab-${snapshot.stats.timestamp.toISOString()}`;
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

  private computePriority(canonical: string): number {
    const tokenCount = canonical.split(/\s+/).filter(Boolean).length;
    return tokenCount > 1 ? 10 + tokenCount : 0;
  }

  private tryBuildAgeBucket(term: VocabTerm, canonical: string): Partial<VocabAgeBucket> | null {
    const digits = canonical.match(/\d{1,3}/g)?.map(Number) ?? [];
    if (digits.length === 0) {
      return null;
    }

    if (digits.length >= 2) {
      const minAge = Math.min(digits[0], digits[1]);
      const maxAge = Math.max(digits[0], digits[1]);
      return {
        term,
        label: canonical,
        minAge,
        maxAge,
        priority: maxAge - minAge,
      };
    }

    const maxAge = digits[0];
    if (canonical.includes('duoi')) {
      return {
        term,
        label: canonical,
        minAge: 0,
        maxAge,
        priority: maxAge,
      };
    }

    return null;
  }

  private buildPhraseRules(): string[] {
    return ['co huong', 'mui huong', 'nuoc hoa', 'danh cho'];
  }
}
