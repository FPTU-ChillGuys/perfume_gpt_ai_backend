import { Migration } from '@mikro-orm/migrations';

export class Migration20260315083426 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "user_message_log" drop constraint "user_message_log_user_log_id_foreign";`
    );

    this.addSql(
      `alter table "user_survey_log" drop constraint "user_survey_log_user_log_id_foreign";`
    );

    this.addSql(
      `alter table "user_search_log" drop constraint "user_search_log_user_log_id_foreign";`
    );

    this.addSql(
      `alter table "message" drop constraint "message_user_message_log_id_foreign";`
    );

    this.addSql(`drop table if exists "user_log" cascade;`);

    this.addSql(`drop table if exists "user_message_log" cascade;`);

    this.addSql(`drop table if exists "user_survey_log" cascade;`);

    this.addSql(`drop table if exists "user_search_log" cascade;`);

    this.addSql(
      `alter table "message" drop constraint "message_user_message_log_id_unique";`
    );
    this.addSql(`alter table "message" drop column "user_message_log_id";`);
  }

  override async down(): Promise<void> {
    this.addSql(
      `create table "user_log" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "is_active" boolean not null default true, "user_id" text null, constraint "user_log_pkey" primary key ("id"));`
    );

    this.addSql(
      `create table "user_message_log" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "is_active" boolean not null default true, "message_id" uuid null, "user_log_id" uuid not null, constraint "user_message_log_pkey" primary key ("id"));`
    );
    this.addSql(
      `alter table "user_message_log" add constraint "user_message_log_message_id_unique" unique ("message_id");`
    );

    this.addSql(
      `create table "user_survey_log" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "is_active" boolean not null default true, "survey_ques_ans_detail_id" uuid null, "user_log_id" uuid not null, constraint "user_survey_log_pkey" primary key ("id"));`
    );

    this.addSql(
      `create table "user_search_log" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "is_active" boolean not null default true, "content" text null, "user_log_id" uuid not null, constraint "user_search_log_pkey" primary key ("id"));`
    );

    this.addSql(
      `alter table "user_message_log" add constraint "user_message_log_message_id_foreign" foreign key ("message_id") references "message" ("id") on update cascade on delete set null;`
    );
    this.addSql(
      `alter table "user_message_log" add constraint "user_message_log_user_log_id_foreign" foreign key ("user_log_id") references "user_log" ("id") on update cascade;`
    );

    this.addSql(
      `alter table "user_survey_log" add constraint "user_survey_log_survey_ques_ans_detail_id_foreign" foreign key ("survey_ques_ans_detail_id") references "survey_question_answer_detail" ("id") on update cascade on delete set null;`
    );
    this.addSql(
      `alter table "user_survey_log" add constraint "user_survey_log_user_log_id_foreign" foreign key ("user_log_id") references "user_log" ("id") on update cascade;`
    );

    this.addSql(
      `alter table "user_search_log" add constraint "user_search_log_user_log_id_foreign" foreign key ("user_log_id") references "user_log" ("id") on update cascade;`
    );

    this.addSql(
      `alter table "message" add column "user_message_log_id" uuid null;`
    );
    this.addSql(
      `alter table "message" add constraint "message_user_message_log_id_foreign" foreign key ("user_message_log_id") references "user_message_log" ("id") on update cascade on delete set null;`
    );
    this.addSql(
      `alter table "message" add constraint "message_user_message_log_id_unique" unique ("user_message_log_id");`
    );
  }
}
