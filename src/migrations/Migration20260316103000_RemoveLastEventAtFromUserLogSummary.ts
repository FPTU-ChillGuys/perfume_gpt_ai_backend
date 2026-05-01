import { Migration } from '@mikro-orm/migrations';

export class Migration20260316103000_RemoveLastEventAtFromUserLogSummary extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "user_log_summary" drop column if exists "last_event_at";`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "user_log_summary" add column if not exists "last_event_at" timestamptz null;`
    );
  }
}
