import { Migration } from '@mikro-orm/migrations';

export class Migration20260222155253 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "inventory_log" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "inventory_log" text not null, constraint "inventory_log_pkey" primary key ("id"));`);

    this.addSql(`create table "review_summary_log" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "product_id" varchar(255) not null, "summary" varchar(255) not null, "sentiment" text check ("sentiment" in ('positive', 'negative', 'neutral')) not null, "review_count" int not null, constraint "review_summary_log_pkey" primary key ("id"));`);

    this.addSql(`drop table if exists "aireview_summary" cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`create table "aireview_summary" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "product_id" varchar(255) not null, "summary" varchar(255) not null, "sentiment" text check ("sentiment" in ('positive', 'negative', 'neutral')) not null, "review_count" int not null, constraint "aireview_summary_pkey" primary key ("id"));`);

    this.addSql(`drop table if exists "inventory_log" cascade;`);

    this.addSql(`drop table if exists "review_summary_log" cascade;`);
  }

}
