import { Migration } from '@mikro-orm/migrations';

export class Migration20260315180000_AddProductLogType extends Migration {

  override async up(): Promise<void> {
    // Mở rộng check constraint event_type để cho phép giá trị 'product'
    this.addSql(`alter table "event_log" drop constraint if exists "event_log_event_type_check";`);
    this.addSql(`alter table "event_log" add constraint "event_log_event_type_check" check ("event_type" in ('message', 'search', 'survey', 'product'));`);

    // Mở rộng check constraint entity_type để cho phép giá trị 'product'
    this.addSql(`alter table "event_log" drop constraint if exists "event_log_entity_type_check";`);
    this.addSql(`alter table "event_log" add constraint "event_log_entity_type_check" check ("entity_type" in ('conversation', 'search', 'survey', 'product'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "event_log" drop constraint if exists "event_log_event_type_check";`);
    this.addSql(`alter table "event_log" add constraint "event_log_event_type_check" check ("event_type" in ('message', 'search', 'survey'));`);

    this.addSql(`alter table "event_log" drop constraint if exists "event_log_entity_type_check";`);
    this.addSql(`alter table "event_log" add constraint "event_log_entity_type_check" check ("entity_type" in ('conversation', 'search', 'survey'));`);
  }

}
