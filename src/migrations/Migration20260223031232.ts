import { Migration } from '@mikro-orm/migrations';

export class Migration20260223031232 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "review_log" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "type_review" text check ("type_review" in ('id', 'all')) not null, "variant_id" text null, "review_log" text not null, constraint "review_log_pkey" primary key ("id"));`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "review_log" cascade;`);
  }

}
