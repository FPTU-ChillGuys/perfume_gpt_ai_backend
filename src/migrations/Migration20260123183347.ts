import { Migration } from '@mikro-orm/migrations';

export class Migration20260123183347 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "admin_instruction" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "instruction" varchar(255) not null, "instruction_type" varchar(255) not null, constraint "admin_instruction_pkey" primary key ("id"));`);

    this.addSql(`create table "airequest_response" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "request_type" text check ("request_type" in ('QUIZ', 'SEARCH', 'RECOMMENDATION')) not null, "prompt" varchar(255) not null, "response" varchar(255) not null, constraint "airequest_response_pkey" primary key ("id"));`);

    this.addSql(`create table "aireview_summary" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "product_id" varchar(255) not null, "summary" varchar(255) not null, "sentiment" text check ("sentiment" in ('positive', 'negative', 'neutral')) not null, "review_count" int not null, constraint "aireview_summary_pkey" primary key ("id"));`);

    this.addSql(`create table "common" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "common_pkey" primary key ("id"));`);

    this.addSql(`create table "conversation" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, constraint "conversation_pkey" primary key ("id"));`);

    this.addSql(`create table "message" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "conversation_id" varchar(255) not null, "sender" text check ("sender" in ('user', 'assistant')) not null, "message" varchar(255) not null, "conversationId" uuid not null, constraint "message_pkey" primary key ("id"));`);

    this.addSql(`create table "quiz_question" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "question" varchar(255) not null, constraint "quiz_question_pkey" primary key ("id"));`);

    this.addSql(`create table "quiz_answer" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "question_id" varchar(255) not null, "answer" varchar(255) not null, "questionId" uuid not null, constraint "quiz_answer_pkey" primary key ("id"));`);

    this.addSql(`create table "quiz_question_answer" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "ai_result" varchar(255) not null, "question_id" uuid not null, "answer_id" uuid not null, constraint "quiz_question_answer_pkey" primary key ("id"));`);

    this.addSql(`alter table "message" add constraint "message_conversationId_foreign" foreign key ("conversationId") references "conversation" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "quiz_answer" add constraint "quiz_answer_questionId_foreign" foreign key ("questionId") references "quiz_question" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "quiz_question_answer" add constraint "quiz_question_answer_question_id_foreign" foreign key ("question_id") references "quiz_question" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "quiz_question_answer" add constraint "quiz_question_answer_answer_id_foreign" foreign key ("answer_id") references "quiz_answer" ("id") on update cascade on delete cascade;`);
  }

}
