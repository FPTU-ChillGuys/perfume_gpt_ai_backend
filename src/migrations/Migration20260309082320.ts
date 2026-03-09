import { Migration } from '@mikro-orm/migrations';

export class Migration20260309082320 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "aiacceptance" add column "cart_item_id" varchar(255) null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "aiacceptance" drop column "cart_item_id";`);
  }

}
