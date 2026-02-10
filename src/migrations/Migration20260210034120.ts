import { Migration } from '@mikro-orm/migrations';

export class Migration20260210034120 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "aiacceptance" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "is_accepted" boolean not null, constraint "aiacceptance_pkey" primary key ("id"));`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "aiacceptance" cascade;`);
  }

}
