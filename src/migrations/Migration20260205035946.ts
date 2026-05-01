import { Migration } from '@mikro-orm/migrations';

export class Migration20260205035946 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "user_log_summary" drop column "total_logs";`);
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "user_log_summary" add column "total_logs" int not null;`
    );
  }
}
