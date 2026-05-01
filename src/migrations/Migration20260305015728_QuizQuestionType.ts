import { Migration } from '@mikro-orm/migrations';

export class Migration20260305015728_SurveyQuestionType extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "survey_question" add column "question_type" text check ("question_type" in ('single', 'multiple')) not null default 'single';`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "survey_question" drop column "question_type";`);
  }
}
