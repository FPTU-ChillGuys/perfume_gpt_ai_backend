import { Migration } from '@mikro-orm/migrations';

export class Migration20260316193000_AddDailySnapshotsToUserLogSummary extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "user_log_summary" add column if not exists "daily_log_summary" jsonb null;`);
    this.addSql(`alter table "user_log_summary" add column if not exists "daily_feature_snapshot" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "user_log_summary" drop column if exists "daily_log_summary";`);
    this.addSql(`alter table "user_log_summary" drop column if exists "daily_feature_snapshot";`);
  }

}
