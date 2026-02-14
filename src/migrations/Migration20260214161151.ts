import { Migration } from '@mikro-orm/migrations';

export class Migration20260214161151 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "quiz_question_answer_detail" drop constraint "quiz_question_answer_detail_user_quiz_log_id_foreign";`);

    this.addSql(`alter table "quiz_question_answer_detail" drop constraint "quiz_question_answer_detail_user_quiz_log_id_unique";`);
    this.addSql(`alter table "quiz_question_answer_detail" drop column "user_quiz_log_id";`);

    this.addSql(`alter table "user_quiz_log" drop constraint "user_quiz_log_quiz_ques_ans_detail_id_unique";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "user_quiz_log" add constraint "user_quiz_log_quiz_ques_ans_detail_id_unique" unique ("quiz_ques_ans_detail_id");`);

    this.addSql(`alter table "quiz_question_answer_detail" add column "user_quiz_log_id" uuid null;`);
    this.addSql(`alter table "quiz_question_answer_detail" add constraint "quiz_question_answer_detail_user_quiz_log_id_foreign" foreign key ("user_quiz_log_id") references "user_quiz_log" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "quiz_question_answer_detail" add constraint "quiz_question_answer_detail_user_quiz_log_id_unique" unique ("user_quiz_log_id");`);
  }

}
