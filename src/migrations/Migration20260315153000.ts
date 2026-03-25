import { Migration } from '@mikro-orm/migrations';

export class Migration20260315153000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "event_log" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "is_active" boolean not null default true, "user_id" text null, "event_type" text check ("event_type" in ('message', 'search', 'survey')) not null, "entity_type" text check ("entity_type" in ('conversation', 'search', 'survey')) not null, "entity_id" uuid null, "content_text" text null, "metadata" jsonb null, constraint "event_log_pkey" primary key ("id"));`);

    this.addSql(`create index "event_log_user_id_created_at_index" on "event_log" ("user_id", "created_at");`);
    this.addSql(`create index "event_log_event_type_created_at_index" on "event_log" ("event_type", "created_at");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "event_log" cascade;`);
  }

}
