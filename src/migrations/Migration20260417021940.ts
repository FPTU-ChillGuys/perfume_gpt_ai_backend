import { Migration } from '@mikro-orm/migrations';

export class Migration20260417021940 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "aiacceptance" alter column "user_id" drop not null;`);
    this.addSql(`alter table "aiacceptance" alter column "is_accepted" drop not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "aiacceptance" alter column "user_id" set not null;`);
    this.addSql(`alter table "aiacceptance" alter column "is_accepted" set not null;`);
  }

}
