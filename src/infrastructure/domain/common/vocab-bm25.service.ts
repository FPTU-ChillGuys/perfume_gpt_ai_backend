import { Injectable, Logger } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { EntityType } from 'src/domain/types/dictionary.types';
import { VocabBm25Result } from 'src/application/dtos/response/dictionary/vocab-bm25-result';

@Injectable()
export class VocabBm25SearchService {
  private readonly logger = new Logger(VocabBm25SearchService.name);

  constructor(private readonly orm: MikroORM) {}

  async search(query: string, limit: number = 10): Promise<VocabBm25Result[]> {
    const em = this.orm.em.fork() as EntityManager;
    const connection = em.getConnection();

    try {
      const results = await connection.execute(
        `SELECT term_id, entity_type, canonical, search_text <@> ? AS score
         FROM vocab_search
         ORDER BY search_text <@> ?
         LIMIT ?`,
        [query, query, limit]
      );

      const rows = this.extractRows(results);
      return rows.map((row) => ({
        termId: row.term_id as string,
        entityType: row.entity_type as EntityType,
        canonical: row.canonical as string,
        score: parseFloat(row.score as string)
      }));
    } catch (error) {
      this.logger.warn(
        `[VocabBm25] Search failed: ${(error as Error).message}`
      );
      return [];
    }
  }

  async searchByEntityType(
    query: string,
    entityType: EntityType,
    limit: number = 10
  ): Promise<VocabBm25Result[]> {
    const em = this.orm.em.fork() as EntityManager;
    const connection = em.getConnection();

    try {
      const results = await connection.execute(
        `SELECT term_id, entity_type, canonical, search_text <@> ? AS score
         FROM vocab_search
         WHERE entity_type = ?
         ORDER BY search_text <@> ?
         LIMIT ?`,
        [query, entityType, query, limit]
      );

      const rows = this.extractRows(results);
      return rows.map((row) => ({
        termId: row.term_id as string,
        entityType: row.entity_type as EntityType,
        canonical: row.canonical as string,
        score: parseFloat(row.score as string)
      }));
    } catch (error) {
      this.logger.warn(
        `[VocabBm25] Search by type failed: ${(error as Error).message}`
      );
      return [];
    }
  }

  async refreshView(): Promise<void> {
    const em = this.orm.em.fork() as EntityManager;
    const connection = em.getConnection();

    try {
      await connection.execute(
        'REFRESH MATERIALIZED VIEW CONCURRENTLY vocab_search'
      );
      this.logger.log('[VocabBm25] Refreshed materialized view');
    } catch (error) {
      this.logger.warn(
        `[VocabBm25] Refresh failed: ${(error as Error).message}`
      );
    }
  }

  private extractRows(result: unknown): Record<string, unknown>[] {
    if (Array.isArray(result)) return result as Record<string, unknown>[];
    const obj = result as Record<string, unknown>;
    if (obj?.rows && Array.isArray(obj.rows))
      return obj.rows as Record<string, unknown>[];
    return [];
  }
}
