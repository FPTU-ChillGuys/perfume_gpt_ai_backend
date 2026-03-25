import { Migration } from '@mikro-orm/migrations';

export class Migration20260214161151 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "survey_question_answer_detail" drop constraint "survey_question_answer_detail_user_survey_log_id_foreign";`);

    this.addSql(`alter table "survey_question_answer_detail" drop constraint "survey_question_answer_detail_user_survey_log_id_unique";`);
    this.addSql(`alter table "survey_question_answer_detail" drop column "user_survey_log_id";`);

    this.addSql(`alter table "user_survey_log" drop constraint "user_survey_log_survey_ques_ans_detail_id_unique";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "user_survey_log" add constraint "user_survey_log_survey_ques_ans_detail_id_unique" unique ("survey_ques_ans_detail_id");`);

    this.addSql(`alter table "survey_question_answer_detail" add column "user_survey_log_id" uuid null;`);
    this.addSql(`alter table "survey_question_answer_detail" add constraint "survey_question_answer_detail_user_survey_log_id_foreign" foreign key ("user_survey_log_id") references "user_survey_log" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "survey_question_answer_detail" add constraint "survey_question_answer_detail_user_survey_log_id_unique" unique ("user_survey_log_id");`);
  }

}
