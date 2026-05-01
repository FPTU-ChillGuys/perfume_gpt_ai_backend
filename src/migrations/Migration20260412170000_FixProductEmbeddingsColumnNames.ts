import { Migration } from '@mikro-orm/migrations';

/**
 * Fix columns for product_embeddings to match MikroORM naming convention.
 * This migration is safe to run on databases where the table was already created
 * with camelCase columns.
 */
export class Migration20260412170000_FixProductEmbeddingsColumnNames extends Migration {
  async up(): Promise<void> {
    this.addSql(`DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_embeddings' AND column_name = 'productId'
  ) THEN
    EXECUTE 'ALTER TABLE "product_embeddings" RENAME COLUMN "productId" TO "product_id"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_embeddings' AND column_name = 'createdAt'
  ) THEN
    EXECUTE 'ALTER TABLE "product_embeddings" RENAME COLUMN "createdAt" TO "created_at"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_embeddings' AND column_name = 'updatedAt'
  ) THEN
    EXECUTE 'ALTER TABLE "product_embeddings" RENAME COLUMN "updatedAt" TO "updated_at"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_embeddings' AND column_name = 'isActive'
  ) THEN
    EXECUTE 'ALTER TABLE "product_embeddings" RENAME COLUMN "isActive" TO "is_active"';
  END IF;
END $$;`);

    this.addSql(`DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'product_embeddings'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_embeddings_product_id" ON "product_embeddings" ("product_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_product_embeddings_product_id" ON "product_embeddings" ("product_id")';
  END IF;
END $$;`);
  }

  async down(): Promise<void> {
    this.addSql(`DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'product_embeddings'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'product_embeddings' AND column_name = 'product_id'
    ) THEN
      EXECUTE 'ALTER TABLE "product_embeddings" RENAME COLUMN "product_id" TO "productId"';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'product_embeddings' AND column_name = 'created_at'
    ) THEN
      EXECUTE 'ALTER TABLE "product_embeddings" RENAME COLUMN "created_at" TO "createdAt"';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'product_embeddings' AND column_name = 'updated_at'
    ) THEN
      EXECUTE 'ALTER TABLE "product_embeddings" RENAME COLUMN "updated_at" TO "updatedAt"';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'product_embeddings' AND column_name = 'is_active'
    ) THEN
      EXECUTE 'ALTER TABLE "product_embeddings" RENAME COLUMN "is_active" TO "isActive"';
    END IF;
  END IF;
END $$;`);
  }
}
