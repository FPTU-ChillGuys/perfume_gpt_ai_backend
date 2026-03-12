import { Migration } from '@mikro-orm/migrations';

export class Migration20260311154643 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "trend_log" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "is_active" boolean not null default true, "trend_data" text not null, constraint "trend_log_pkey" primary key ("id"));`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "trend_log" cascade;`);
  }

}
