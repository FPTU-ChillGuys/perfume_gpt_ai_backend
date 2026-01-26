import { Migration } from '@mikro-orm/migrations';

export class Migration20260126175647 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`drop table if exists "admin_instruction" cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`create table "admin_instruction" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "instruction" varchar(255) not null, "instruction_type" varchar(255) not null, constraint "admin_instruction_pkey" primary key ("id"));`);
  }

}
