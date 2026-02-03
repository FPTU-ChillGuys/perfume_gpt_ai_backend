import { Migration } from '@mikro-orm/migrations';

export class Migration20260203051500 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "user_message_log" drop constraint "user_message_log_message_id_foreign";`);

    this.addSql(`alter table "message" drop constraint "message_user_message_log_id_foreign";`);

    this.addSql(`alter table "user_quiz_log" drop constraint "user_quiz_log_quiz_ques_ans_detail_id_foreign";`);

    this.addSql(`alter table "user_message_log" alter column "message_id" drop default;`);
    this.addSql(`alter table "user_message_log" alter column "message_id" type uuid using ("message_id"::text::uuid);`);
    this.addSql(`alter table "user_message_log" alter column "message_id" drop not null;`);
    this.addSql(`alter table "user_message_log" add constraint "user_message_log_message_id_foreign" foreign key ("message_id") references "message" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "message" alter column "user_message_log_id" drop default;`);
    this.addSql(`alter table "message" alter column "user_message_log_id" type uuid using ("user_message_log_id"::text::uuid);`);
    this.addSql(`alter table "message" alter column "user_message_log_id" drop not null;`);
    this.addSql(`alter table "message" add constraint "message_user_message_log_id_foreign" foreign key ("user_message_log_id") references "user_message_log" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "user_quiz_log" alter column "quiz_ques_ans_detail_id" drop default;`);
    this.addSql(`alter table "user_quiz_log" alter column "quiz_ques_ans_detail_id" type uuid using ("quiz_ques_ans_detail_id"::text::uuid);`);
    this.addSql(`alter table "user_quiz_log" alter column "quiz_ques_ans_detail_id" drop not null;`);
    this.addSql(`alter table "user_quiz_log" add constraint "user_quiz_log_quiz_ques_ans_detail_id_foreign" foreign key ("quiz_ques_ans_detail_id") references "quiz_question_answer_detail" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "user_message_log" drop constraint "user_message_log_message_id_foreign";`);

    this.addSql(`alter table "message" drop constraint "message_user_message_log_id_foreign";`);

    this.addSql(`alter table "user_quiz_log" drop constraint "user_quiz_log_quiz_ques_ans_detail_id_foreign";`);

    this.addSql(`alter table "user_message_log" alter column "message_id" drop default;`);
    this.addSql(`alter table "user_message_log" alter column "message_id" type uuid using ("message_id"::text::uuid);`);
    this.addSql(`alter table "user_message_log" alter column "message_id" set not null;`);
    this.addSql(`alter table "user_message_log" add constraint "user_message_log_message_id_foreign" foreign key ("message_id") references "message" ("id") on update cascade;`);

    this.addSql(`alter table "message" alter column "user_message_log_id" drop default;`);
    this.addSql(`alter table "message" alter column "user_message_log_id" type uuid using ("user_message_log_id"::text::uuid);`);
    this.addSql(`alter table "message" alter column "user_message_log_id" set not null;`);
    this.addSql(`alter table "message" add constraint "message_user_message_log_id_foreign" foreign key ("user_message_log_id") references "user_message_log" ("id") on update cascade;`);

    this.addSql(`alter table "user_quiz_log" alter column "quiz_ques_ans_detail_id" drop default;`);
    this.addSql(`alter table "user_quiz_log" alter column "quiz_ques_ans_detail_id" type uuid using ("quiz_ques_ans_detail_id"::text::uuid);`);
    this.addSql(`alter table "user_quiz_log" alter column "quiz_ques_ans_detail_id" set not null;`);
    this.addSql(`alter table "user_quiz_log" add constraint "user_quiz_log_quiz_ques_ans_detail_id_foreign" foreign key ("quiz_ques_ans_detail_id") references "quiz_question_answer_detail" ("id") on update cascade;`);
  }

}
