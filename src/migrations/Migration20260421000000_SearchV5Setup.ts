import { Migration } from '@mikro-orm/migrations';

/**
 * Migration để nâng cấp Product Search lên v5 (BM25 + Hybrid Search)
 */
export class MigrationSearchV5Setup extends Migration {
  async up(): Promise<void> {
    // 1. Thêm cột search_text để lưu structured content
    this.addSql('ALTER TABLE product_embeddings ADD COLUMN IF NOT EXISTS search_text TEXT;');

    // 2. Tạo index BM25 cho cột search_text
    // Lưu ý: Cần extension pg_textsearch đã được cài đặt
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_product_embeddings_bm25 
      ON product_embeddings 
      USING bm25(search_text)
      WITH (text_config='simple');
    `);

    console.log('Added search_text column and BM25 index for Search v5');
  }

  async down(): Promise<void> {
    // Xóa index
    this.addSql('DROP INDEX IF EXISTS idx_product_embeddings_bm25;');

    // Xóa cột
    this.addSql('ALTER TABLE product_embeddings DROP COLUMN IF EXISTS search_text;');

    console.log('Removed Search v5 components');
  }
}
