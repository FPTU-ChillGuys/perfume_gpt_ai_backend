import { Migration } from '@mikro-orm/migrations';

export class Migration20260429000000_AddSurveyOrderAndAiResult extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "survey_question" ADD COLUMN "order" integer NOT NULL DEFAULT 0;`
    );
    this.addSql(
      `ALTER TABLE "survey_question_answer" ADD COLUMN "ai_result" text NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "survey_question" DROP COLUMN "order";`);
    this.addSql(
      `ALTER TABLE "survey_question_answer" DROP COLUMN "ai_result";`
    );
  }
}
