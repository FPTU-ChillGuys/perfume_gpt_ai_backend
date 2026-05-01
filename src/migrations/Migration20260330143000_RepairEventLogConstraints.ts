import { Migration } from '@mikro-orm/migrations';

export class Migration20260330143000_RepairEventLogConstraints extends Migration {
  override async up(): Promise<void> {
    // 1. Drop existing constraints FIRST so we can update the data without violations
    this.addSql(
      `alter table "event_log" drop constraint if exists "event_log_event_type_check";`
    );
    this.addSql(
      `alter table "event_log" drop constraint if exists "event_log_entity_type_check";`
    );

    // 2. Data Cleanup: Update 'quiz' to 'survey' now that constraints are gone
    this.addSql(
      `update "event_log" set "event_type" = 'survey' where "event_type" = 'quiz';`
    );
    this.addSql(
      `update "event_log" set "entity_type" = 'survey' where "entity_type" = 'quiz';`
    );

    // 3. Add correct constraints including all current types: 'message', 'search', 'survey', 'product'
    this.addSql(
      `alter table "event_log" add constraint "event_log_event_type_check" check ("event_type" in ('message', 'search', 'survey', 'product'));`
    );

    // 4. Add correct constraints for entity_type including 'conversation', 'search', 'survey', 'product'
    this.addSql(
      `alter table "event_log" add constraint "event_log_entity_type_check" check ("entity_type" in ('conversation', 'search', 'survey', 'product'));`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "event_log" drop constraint if exists "event_log_event_type_check";`
    );
    this.addSql(
      `alter table "event_log" drop constraint if exists "event_log_entity_type_check";`
    );

    // Only restore basic types for safety
    this.addSql(
      `alter table "event_log" add constraint "event_log_event_type_check" check ("event_type" in ('message', 'search'));`
    );
    this.addSql(
      `alter table "event_log" add constraint "event_log_entity_type_check" check ("entity_type" in ('conversation', 'search'));`
    );
  }
}
