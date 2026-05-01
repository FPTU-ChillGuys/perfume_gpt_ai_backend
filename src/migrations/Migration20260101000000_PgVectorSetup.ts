import { Migration } from '@mikro-orm/migrations';

/**
 * Migration để thêm pgvector extension và tạo table product_embeddings
 * Chạy migration này để setup database cho Hybrid Search v4
 */
export class Migration20260101000000 extends Migration {
  async up(): Promise<void> {
    // Thêm pgvector extension
    this.addSql('CREATE EXTENSION IF NOT EXISTS vector;');

    // Tạo table product_embeddings
    this.addSql(`
      CREATE TABLE IF NOT EXISTS product_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id TEXT NOT NULL,
        vector vector(1024),
        description TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        is_active BOOLEAN NOT NULL DEFAULT true,
        CONSTRAINT "UQ_product_embeddings_product_id" UNIQUE (product_id)
      );
    `);

    // Tạo index cho productId
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_product_embeddings_product_id" ON product_embeddings (product_id);'
    );

    // Tạo index cho vector search (hnsw index cho cosine similarity)
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_product_embeddings_vector" ON product_embeddings USING hnsw ("vector" vector_cosine_ops);'
    );

    console.log(
      'Added pgvector extension and created product_embeddings table'
    );
  }

  async down(): Promise<void> {
    // Xóa table product_embeddings
    this.addSql('DROP TABLE IF EXISTS product_embeddings CASCADE;');

    // Xóa pgvector extension
    this.addSql('DROP EXTENSION IF EXISTS vector;');

    console.log('Dropped product_embeddings table and pgvector extension');
  }
}
