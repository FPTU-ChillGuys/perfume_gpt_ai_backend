import { Migration } from '@mikro-orm/migrations';

export class Migration20260425094545_FixSearchTextColumn extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "aiacceptance" drop column "user_id", drop column "cart_item_id";`
    );

    this.addSql(
      `alter table "product_embeddings" add column "search_text" text null;`
    );
    this.addSql(
      `alter table "product_embeddings" alter column "vector" type vector(1024) using ("vector"::vector(1024));`
    );
    this.addSql(
      `alter table "product_embeddings" alter column "description" type text using ("description"::text);`
    );
    this.addSql(
      `alter table "product_embeddings" alter column "description" drop not null;`
    );

    // Thêm index BM25 nếu chưa có
    this.addSql(
      `CREATE INDEX IF NOT EXISTS idx_product_embeddings_bm25 ON product_embeddings USING bm25(search_text) WITH (text_config='simple');`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "aiacceptance" add column "user_id" varchar(255) null, add column "cart_item_id" varchar(255) null;`
    );
    this.addSql(`DROP INDEX IF EXISTS idx_product_embeddings_bm25;`);
    this.addSql(`alter table "product_embeddings" drop column "search_text";`);

    this.addSql(
      `alter table "product_embeddings" alter column "vector" type vector(1536) using ("vector"::vector(1536));`
    );
    this.addSql(
      `alter table "product_embeddings" alter column "description" type text using ("description"::text);`
    );
    this.addSql(
      `alter table "product_embeddings" alter column "description" set not null;`
    );
  }
}
