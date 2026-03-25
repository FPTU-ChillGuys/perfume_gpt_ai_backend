import { Migration } from '@mikro-orm/migrations';

export class Migration20260325140000_RenameQuizToSurvey extends Migration {

    override async up(): Promise<void> {
        // Rename tables
        this.addSql('ALTER TABLE "quiz_question" RENAME TO "survey_question";');
        this.addSql('ALTER TABLE "quiz_answer" RENAME TO "survey_answer";');
        this.addSql('ALTER TABLE "quiz_question_answer" RENAME TO "survey_question_answer";');
        this.addSql('ALTER TABLE "quiz_question_answer_detail" RENAME TO "survey_question_answer_detail";');

        // Rename PKeys
        this.addSql('ALTER TABLE "survey_question" RENAME CONSTRAINT "quiz_question_pkey" TO "survey_question_pkey";');
        this.addSql('ALTER TABLE "survey_answer" RENAME CONSTRAINT "quiz_answer_pkey" TO "survey_answer_pkey";');
        this.addSql('ALTER TABLE "survey_question_answer" RENAME CONSTRAINT "quiz_question_answer_pkey" TO "survey_question_answer_pkey";');
        this.addSql('ALTER TABLE "survey_question_answer_detail" RENAME CONSTRAINT "quiz_question_answer_detail_pkey" TO "survey_question_answer_detail_pkey";');

        // Rename Foreign Keys
        this.addSql('ALTER TABLE "survey_answer" RENAME CONSTRAINT "quiz_answer_question_id_foreign" TO "survey_answer_question_id_foreign";');
        this.addSql('ALTER TABLE "survey_question_answer" RENAME CONSTRAINT "quiz_question_answer_question_id_foreign" TO "survey_question_answer_question_id_foreign";');
        this.addSql('ALTER TABLE "survey_question_answer" RENAME CONSTRAINT "quiz_question_answer_answer_id_foreign" TO "survey_question_answer_answer_id_foreign";');
        this.addSql('ALTER TABLE "survey_question_answer_detail" RENAME CONSTRAINT "quiz_question_answer_detail_question_id_foreign" TO "survey_question_answer_detail_question_id_foreign";');
        this.addSql('ALTER TABLE "survey_question_answer_detail" RENAME CONSTRAINT "quiz_question_answer_detail_answer_id_foreign" TO "survey_question_answer_detail_answer_id_foreign";');
        this.addSql('ALTER TABLE "survey_question_answer_detail" RENAME CONSTRAINT "quiz_question_answer_detail_ques_ans_id_foreign" TO "survey_question_answer_detail_ques_ans_id_foreign";');

        // user_quiz_log was dropped, so no need to rename it
    }

    override async down(): Promise<void> {
        // Revert renames
        this.addSql('ALTER TABLE "survey_question" RENAME TO "quiz_question";');
        this.addSql('ALTER TABLE "survey_answer" RENAME TO "quiz_answer";');
        this.addSql('ALTER TABLE "survey_question_answer" RENAME TO "quiz_question_answer";');
        this.addSql('ALTER TABLE "survey_question_answer_detail" RENAME TO "quiz_question_answer_detail";');

        // Revert PKeys
        this.addSql('ALTER TABLE "quiz_question" RENAME CONSTRAINT "survey_question_pkey" TO "quiz_question_pkey";');
        this.addSql('ALTER TABLE "quiz_answer" RENAME CONSTRAINT "survey_answer_pkey" TO "quiz_answer_pkey";');
        this.addSql('ALTER TABLE "quiz_question_answer" RENAME CONSTRAINT "survey_question_answer_pkey" TO "quiz_question_answer_pkey";');
        this.addSql('ALTER TABLE "quiz_question_answer_detail" RENAME CONSTRAINT "survey_question_answer_detail_pkey" TO "quiz_question_answer_detail_pkey";');

        // Revert Foreign Keys
        this.addSql('ALTER TABLE "quiz_answer" RENAME CONSTRAINT "survey_answer_question_id_foreign" TO "quiz_answer_question_id_foreign";');
        this.addSql('ALTER TABLE "quiz_question_answer" RENAME CONSTRAINT "survey_question_answer_question_id_foreign" TO "quiz_question_answer_question_id_foreign";');
        this.addSql('ALTER TABLE "quiz_question_answer" RENAME CONSTRAINT "survey_question_answer_answer_id_foreign" TO "quiz_question_answer_answer_id_foreign";');
        this.addSql('ALTER TABLE "quiz_question_answer_detail" RENAME CONSTRAINT "survey_question_answer_detail_question_id_foreign" TO "quiz_question_answer_detail_question_id_foreign";');
        this.addSql('ALTER TABLE "quiz_question_answer_detail" RENAME CONSTRAINT "survey_question_answer_detail_answer_id_foreign" TO "quiz_question_answer_detail_answer_id_foreign";');
        this.addSql('ALTER TABLE "quiz_question_answer_detail" RENAME CONSTRAINT "survey_question_answer_detail_ques_ans_id_foreign" TO "quiz_question_answer_detail_ques_ans_id_foreign";');
    }

}
