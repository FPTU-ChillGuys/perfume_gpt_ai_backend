import { Migration } from '@mikro-orm/migrations';

export class Migration20260205034216 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "user_log" alter column "user_id" type text using ("user_id"::text);`);
    this.addSql(`alter table "user_log" alter column "user_id" drop not null;`);

    this.addSql(`alter table "user_log_summary" drop column "period";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "user_log" alter column "user_id" type varchar(255) using ("user_id"::varchar(255));`);
    this.addSql(`alter table "user_log" alter column "user_id" set not null;`);

    this.addSql(`alter table "user_log_summary" add column "period" text check ("period" in ('weekly', 'monthly', 'yearly')) not null;`);
  }

}
