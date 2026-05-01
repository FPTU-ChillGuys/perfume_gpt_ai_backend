import { Migration } from '@mikro-orm/migrations';

export class Migration20260315170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "user_log_summary" alter column "user_id" type text using ("user_id"::text);`
    );

    this.addSql(
      `delete from "user_log_summary" a using "user_log_summary" b where a.user_id = b.user_id and (a.updated_at < b.updated_at or (a.updated_at = b.updated_at and a.id < b.id));`
    );

    this.addSql(
      `alter table "user_log_summary" drop column if exists "start_date";`
    );
    this.addSql(
      `alter table "user_log_summary" drop column if exists "end_date";`
    );

    this.addSql(
      `alter table "user_log_summary" add column if not exists "feature_snapshot" jsonb null;`
    );
    this.addSql(
      `alter table "user_log_summary" add column if not exists "last_event_at" timestamptz null;`
    );
    this.addSql(
      `alter table "user_log_summary" add column if not exists "total_events" int not null default 0;`
    );

    this.addSql(
      `create unique index if not exists "user_log_summary_user_id_unique" on "user_log_summary" ("user_id");`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "user_log_summary_user_id_unique";`);

    this.addSql(
      `alter table "user_log_summary" drop column if exists "feature_snapshot";`
    );
    this.addSql(
      `alter table "user_log_summary" drop column if exists "last_event_at";`
    );
    this.addSql(
      `alter table "user_log_summary" drop column if exists "total_events";`
    );

    this.addSql(
      `alter table "user_log_summary" add column if not exists "start_date" timestamptz null;`
    );
    this.addSql(
      `alter table "user_log_summary" add column if not exists "end_date" timestamptz null;`
    );
  }
}
