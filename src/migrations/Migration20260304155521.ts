import { Migration } from '@mikro-orm/migrations';

export class Migration20260304155521 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "admin_instruction" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "aiacceptance" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "common" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "conversation" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "inventory_log" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "survey_question" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "survey_answer" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "survey_question_answer" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "survey_question_answer_detail" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "review_log" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "review_summary_log" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "user_log" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "user_log_summary" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "user_message_log" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "message" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "user_survey_log" add column "is_active" boolean not null default true;`
    );

    this.addSql(
      `alter table "user_search_log" add column "is_active" boolean not null default true;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "admin_instruction" drop column "is_active";`);

    this.addSql(`alter table "aiacceptance" drop column "is_active";`);

    this.addSql(`alter table "common" drop column "is_active";`);

    this.addSql(`alter table "conversation" drop column "is_active";`);

    this.addSql(`alter table "inventory_log" drop column "is_active";`);

    this.addSql(`alter table "survey_question" drop column "is_active";`);

    this.addSql(`alter table "survey_answer" drop column "is_active";`);

    this.addSql(
      `alter table "survey_question_answer" drop column "is_active";`
    );

    this.addSql(
      `alter table "survey_question_answer_detail" drop column "is_active";`
    );

    this.addSql(`alter table "review_log" drop column "is_active";`);

    this.addSql(`alter table "review_summary_log" drop column "is_active";`);

    this.addSql(`alter table "user_log" drop column "is_active";`);

    this.addSql(`alter table "user_log_summary" drop column "is_active";`);

    this.addSql(`alter table "user_message_log" drop column "is_active";`);

    this.addSql(`alter table "message" drop column "is_active";`);

    this.addSql(`alter table "user_survey_log" drop column "is_active";`);

    this.addSql(`alter table "user_search_log" drop column "is_active";`);
  }
}
