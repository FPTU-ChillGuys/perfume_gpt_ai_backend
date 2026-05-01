import { Migration } from '@mikro-orm/migrations';

export class Migration20260201101736 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "admin_instruction" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "instruction" varchar(255) not null, "instruction_type" varchar(255) not null, constraint "admin_instruction_pkey" primary key ("id"));`
    );

    this.addSql(
      `create table "user_log" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, constraint "user_log_pkey" primary key ("id"));`
    );

    this.addSql(
      `create table "user_message_log" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "message_id" uuid not null, "user_log_id" uuid not null, constraint "user_message_log_pkey" primary key ("id"));`
    );
    this.addSql(
      `alter table "user_message_log" add constraint "user_message_log_message_id_unique" unique ("message_id");`
    );

    this.addSql(
      `create table "user_survey_log" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "survey_ques_ans_detail_id" uuid not null, "user_log_id" uuid not null, constraint "user_survey_log_pkey" primary key ("id"));`
    );
    this.addSql(
      `alter table "user_survey_log" add constraint "user_survey_log_survey_ques_ans_detail_id_unique" unique ("survey_ques_ans_detail_id");`
    );

    this.addSql(
      `create table "user_search_log" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "content" varchar(255) null, "user_log_id" uuid not null, constraint "user_search_log_pkey" primary key ("id"));`
    );

    this.addSql(
      `alter table "user_message_log" add constraint "user_message_log_message_id_foreign" foreign key ("message_id") references "message" ("id") on update cascade;`
    );
    this.addSql(
      `alter table "user_message_log" add constraint "user_message_log_user_log_id_foreign" foreign key ("user_log_id") references "user_log" ("id") on update cascade;`
    );

    this.addSql(
      `alter table "user_survey_log" add constraint "user_survey_log_survey_ques_ans_detail_id_foreign" foreign key ("survey_ques_ans_detail_id") references "survey_question_answer_detail" ("id") on update cascade;`
    );
    this.addSql(
      `alter table "user_survey_log" add constraint "user_survey_log_user_log_id_foreign" foreign key ("user_log_id") references "user_log" ("id") on update cascade;`
    );

    this.addSql(
      `alter table "user_search_log" add constraint "user_search_log_user_log_id_foreign" foreign key ("user_log_id") references "user_log" ("id") on update cascade;`
    );

    this.addSql(`drop table if exists "airequest_response" cascade;`);

    this.addSql(
      `alter table "message" add column "user_message_log_id" uuid not null;`
    );
    this.addSql(
      `alter table "message" add constraint "message_user_message_log_id_foreign" foreign key ("user_message_log_id") references "user_message_log" ("id") on update cascade;`
    );
    this.addSql(
      `alter table "message" add constraint "message_user_message_log_id_unique" unique ("user_message_log_id");`
    );

    this.addSql(
      `alter table "survey_question_answer_detail" add column "user_survey_log_id" uuid null;`
    );
    this.addSql(
      `alter table "survey_question_answer_detail" add constraint "survey_question_answer_detail_user_survey_log_id_foreign" foreign key ("user_survey_log_id") references "user_survey_log" ("id") on update cascade on delete set null;`
    );
    this.addSql(
      `alter table "survey_question_answer_detail" add constraint "survey_question_answer_detail_user_survey_log_id_unique" unique ("user_survey_log_id");`
    );
  }

  override async down(): Promise<void> {
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

    this.addSql(
      `alter table "survey_question_answer_detail" drop constraint "survey_question_answer_detail_user_survey_log_id_foreign";`
    );

    this.addSql(
      `create table "airequest_response" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "request_type" text check ("request_type" in ('SURVEY', 'SEARCH', 'RECOMMENDATION')) not null, "prompt" varchar(255) not null, "response" varchar(255) not null, constraint "airequest_response_pkey" primary key ("id"));`
    );

    this.addSql(`drop table if exists "admin_instruction" cascade;`);

    this.addSql(`drop table if exists "user_log" cascade;`);

    this.addSql(`drop table if exists "user_message_log" cascade;`);

    this.addSql(`drop table if exists "user_survey_log" cascade;`);

    this.addSql(`drop table if exists "user_search_log" cascade;`);

    this.addSql(
      `alter table "message" drop constraint "message_user_message_log_id_unique";`
    );
    this.addSql(`alter table "message" drop column "user_message_log_id";`);

    this.addSql(
      `alter table "survey_question_answer_detail" drop constraint "survey_question_answer_detail_user_survey_log_id_unique";`
    );
    this.addSql(
      `alter table "survey_question_answer_detail" drop column "user_survey_log_id";`
    );
  }
}
