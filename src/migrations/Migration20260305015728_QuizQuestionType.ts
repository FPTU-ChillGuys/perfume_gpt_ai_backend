import { Migration } from '@mikro-orm/migrations';

export class Migration20260305015728_QuizQuestionType extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "quiz_question" add column "question_type" text check ("question_type" in ('single', 'multiple')) not null default 'single';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "quiz_question" drop column "question_type";`);
  }

}
