import { Migration } from '@mikro-orm/migrations';

export class Migration20260429000001_RebuildSurveyOrder extends Migration {

  override async up(): Promise<void> {
    this.addSql(`UPDATE "survey_question" SET "order" = subq.row_num FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY "updated_at" ASC) AS row_num FROM "survey_question" WHERE "is_active" = true) AS subq WHERE "survey_question"."id" = subq.id;`);
  }

  override async down(): Promise<void> {
    this.addSql(`UPDATE "survey_question" SET "order" = 0 WHERE "is_active" = true;`);
  }

}