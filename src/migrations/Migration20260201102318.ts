import { Migration } from '@mikro-orm/migrations';

export class Migration20260201102318 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "user_log_summary" alter column "period" type text using ("period"::text);`
    );
    this.addSql(
      `alter table "user_log_summary" add constraint "user_log_summary_period_check" check("period" in ('weekly', 'monthly', 'yearly'));`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "user_log_summary" drop constraint if exists "user_log_summary_period_check";`
    );

    this.addSql(
      `alter table "user_log_summary" alter column "period" type varchar(255) using ("period"::varchar(255));`
    );
  }
}
