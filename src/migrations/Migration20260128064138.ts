import { Migration } from '@mikro-orm/migrations';

export class Migration20260128064138 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "survey_question_answer_detail" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "question_id" uuid not null, "answer_id" uuid not null, "ques_ans_id" uuid not null, constraint "survey_question_answer_detail_pkey" primary key ("id"));`);

    this.addSql(`alter table "survey_question_answer_detail" add constraint "survey_question_answer_detail_question_id_foreign" foreign key ("question_id") references "survey_question" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "survey_question_answer_detail" add constraint "survey_question_answer_detail_answer_id_foreign" foreign key ("answer_id") references "survey_answer" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "survey_question_answer_detail" add constraint "survey_question_answer_detail_ques_ans_id_foreign" foreign key ("ques_ans_id") references "survey_question_answer" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "survey_question_answer" drop constraint "survey_question_answer_question_id_foreign";`);
    this.addSql(`alter table "survey_question_answer" drop constraint "survey_question_answer_answer_id_foreign";`);

    this.addSql(`alter table "survey_question_answer" drop column "ai_result", drop column "question_id", drop column "answer_id";`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "survey_question_answer_detail" cascade;`);

    this.addSql(`alter table "survey_question_answer" add column "ai_result" varchar(255) not null, add column "question_id" uuid not null, add column "answer_id" uuid not null;`);
    this.addSql(`alter table "survey_question_answer" add constraint "survey_question_answer_question_id_foreign" foreign key ("question_id") references "survey_question" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "survey_question_answer" add constraint "survey_question_answer_answer_id_foreign" foreign key ("answer_id") references "survey_answer" ("id") on update cascade on delete cascade;`);
  }

}
