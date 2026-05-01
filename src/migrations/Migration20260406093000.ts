import { Migration } from '@mikro-orm/migrations';

export class Migration20260406093000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "aiacceptance" add column "response_id" varchar(255) null;`
    );
    this.addSql(
      `alter table "aiacceptance" add column "context_type" varchar(64) null;`
    );
    this.addSql(
      `alter table "aiacceptance" add column "source_ref_id" varchar(255) null;`
    );
    this.addSql(
      `alter table "aiacceptance" add column "product_ids_json" text null;`
    );
    this.addSql(
      `alter table "aiacceptance" add column "metadata_json" text null;`
    );
    this.addSql(
      `alter table "aiacceptance" add column "visible_after_at" timestamptz null;`
    );
    this.addSql(
      `alter table "aiacceptance" add column "clicked_at" timestamptz null;`
    );

    this.addSql(
      `create index "aiacceptance_user_id_idx_20260406" on "aiacceptance" ("user_id");`
    );
    this.addSql(
      `create index "aiacceptance_response_id_idx_20260406" on "aiacceptance" ("response_id");`
    );
    this.addSql(
      `create index "aiacceptance_context_type_idx_20260406" on "aiacceptance" ("context_type");`
    );
    this.addSql(
      `create index "aiacceptance_visible_after_idx_20260406" on "aiacceptance" ("visible_after_at");`
    );

    this.addSql(
      `update "aiacceptance" set "context_type" = 'cart_legacy' where "context_type" is null;`
    );
    this.addSql(
      `update "aiacceptance" set "response_id" = cast("id" as text) where "response_id" is null;`
    );
    this.addSql(
      `update "aiacceptance" set "visible_after_at" = "created_at" where "visible_after_at" is null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index if exists "aiacceptance_visible_after_idx_20260406";`
    );
    this.addSql(
      `drop index if exists "aiacceptance_context_type_idx_20260406";`
    );
    this.addSql(
      `drop index if exists "aiacceptance_response_id_idx_20260406";`
    );
    this.addSql(`drop index if exists "aiacceptance_user_id_idx_20260406";`);

    this.addSql(`alter table "aiacceptance" drop column "clicked_at";`);
    this.addSql(`alter table "aiacceptance" drop column "visible_after_at";`);
    this.addSql(`alter table "aiacceptance" drop column "metadata_json";`);
    this.addSql(`alter table "aiacceptance" drop column "product_ids_json";`);
    this.addSql(`alter table "aiacceptance" drop column "source_ref_id";`);
    this.addSql(`alter table "aiacceptance" drop column "context_type";`);
    this.addSql(`alter table "aiacceptance" drop column "response_id";`);
  }
}
