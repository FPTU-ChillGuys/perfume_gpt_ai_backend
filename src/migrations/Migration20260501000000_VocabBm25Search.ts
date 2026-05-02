import { Migration } from '@mikro-orm/migrations';

/**
 * Phase C: BM25 search on vocab entities for fuzzy alias matching.
 * Creates a materialized view joining terms + aliases into searchable text,
 * then builds a BM25 index using pg_textsearch.
 */
export class Migration20260501000000_VocabBm25Search extends Migration {
  override async up(): Promise<void> {
    // 1. Materialized view: flattens vocab_term + vocab_alias into searchable rows
    this.addSql(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS vocab_search AS
      SELECT
        t.id AS term_id,
        t.entity_type,
        t.canonical,
        t.normalized_canonical,
        STRING_AGG(a.alias_text, ' ') AS alias_texts,
        STRING_AGG(a.normalized_alias, ' ') AS normalized_alias_texts,
        (
          t.entity_type || ': ' ||
          t.canonical || ' ' ||
          COALESCE(STRING_AGG(a.alias_text, ' '), '') || ' ' ||
          COALESCE(STRING_AGG(a.normalized_alias, ' '), '')
        ) AS search_text
      FROM vocab_term t
      LEFT JOIN vocab_alias a ON a.term_id = t.id AND a.is_active = true
      WHERE t.is_active = true
      GROUP BY t.id, t.entity_type, t.canonical, t.normalized_canonical;
    `);

    // 2. Unique index on term_id for materialized view
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_vocab_search_term_id
      ON vocab_search (term_id);
    `);

    // 3. BM25 index on search_text using pg_textsearch
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_vocab_search_bm25
      ON vocab_search
      USING bm25(search_text)
      WITH (text_config = 'simple');
    `);

    console.log('Created vocab_search materialized view + BM25 index');
  }

  override async down(): Promise<void> {
    this.addSql('DROP INDEX IF EXISTS idx_vocab_search_bm25;');
    this.addSql('DROP INDEX IF EXISTS idx_vocab_search_term_id;');
    this.addSql('DROP MATERIALIZED VIEW IF EXISTS vocab_search;');
    console.log('Dropped vocab_search materialized view + BM25 index');
  }
}
