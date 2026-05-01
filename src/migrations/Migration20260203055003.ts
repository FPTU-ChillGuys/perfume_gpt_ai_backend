import { Migration } from '@mikro-orm/migrations';

export class Migration20260203055003 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "survey_answer" alter column "answer" type text using ("answer"::text);`
    );

    this.addSql(
      `alter table "user_log_summary" alter column "log_summary" type text using ("log_summary"::text);`
    );

    this.addSql(
      `alter table "message" alter column "message" type text using ("message"::text);`
    );

    this.addSql(
      `alter table "user_search_log" alter column "content" type text using ("content"::text);`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "survey_answer" alter column "answer" type varchar(255) using ("answer"::varchar(255));`
    );

    this.addSql(
      `alter table "user_log_summary" alter column "log_summary" type varchar(255) using ("log_summary"::varchar(255));`
    );

    this.addSql(
      `alter table "message" alter column "message" type varchar(255) using ("message"::varchar(255));`
    );

    this.addSql(
      `alter table "user_search_log" alter column "content" type varchar(255) using ("content"::varchar(255));`
    );
  }
}
