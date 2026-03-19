import { Migration } from '@mikro-orm/migrations';

export class Migration20260319103000_AIAcceptanceSourceType extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "aiacceptance" add column "source_type" varchar(255) not null default 'CART', add column "source_id" varchar(255) null;`);
    this.addSql(`update "aiacceptance" set "source_id" = "cart_item_id", "source_type" = 'CART' where "cart_item_id" is not null;`);
    this.addSql(`alter table "aiacceptance" alter column "source_type" drop default;`);
    this.addSql(`alter table "aiacceptance" drop column "cart_item_id";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "aiacceptance" add column "cart_item_id" varchar(255) null;`);
    this.addSql(`update "aiacceptance" set "cart_item_id" = "source_id" where "source_type" = 'CART';`);
    this.addSql(`alter table "aiacceptance" drop column "source_type", drop column "source_id";`);
  }

}