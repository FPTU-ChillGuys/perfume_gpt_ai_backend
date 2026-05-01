import { Migration } from '@mikro-orm/migrations';

export class Migration20260311160848 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "inventory_log" add column "type" text check ("type" in ('REPORT', 'RESTOCK')) not null default 'REPORT';`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "inventory_log" drop column "type";`);
  }
}
