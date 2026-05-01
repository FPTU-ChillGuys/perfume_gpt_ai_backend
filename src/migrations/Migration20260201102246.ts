import { Migration } from '@mikro-orm/migrations';

export class Migration20260201102246 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "user_log_summary" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "period" varchar(255) not null, "start_date" timestamptz not null, "end_date" timestamptz not null, "total_logs" int not null, "log_summary" varchar(255) not null, constraint "user_log_summary_pkey" primary key ("id"));`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "user_log_summary" cascade;`);
  }
}
