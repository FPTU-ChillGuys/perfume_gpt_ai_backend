import { Migration } from '@mikro-orm/migrations';

export class Migration20260211075732 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "admin_instruction" alter column "instruction" type text using ("instruction"::text);`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "admin_instruction" alter column "instruction" type varchar(255) using ("instruction"::varchar(255));`
    );
  }
}
