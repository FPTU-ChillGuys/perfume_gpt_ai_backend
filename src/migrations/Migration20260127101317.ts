import { Migration } from '@mikro-orm/migrations';

export class Migration20260127101317 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "message" drop constraint "message_conversationId_foreign";`);

    this.addSql(`alter table "survey_answer" drop constraint "survey_answer_questionId_foreign";`);

    this.addSql(`alter table "message" drop column "conversationId";`);

    this.addSql(`alter table "message" alter column "conversation_id" drop default;`);
    this.addSql(`alter table "message" alter column "conversation_id" type uuid using ("conversation_id"::text::uuid);`);
    this.addSql(`alter table "message" add constraint "message_conversation_id_foreign" foreign key ("conversation_id") references "conversation" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "survey_answer" drop column "questionId";`);

    this.addSql(`alter table "survey_answer" alter column "question_id" drop default;`);
    this.addSql(`alter table "survey_answer" alter column "question_id" type uuid using ("question_id"::text::uuid);`);
    this.addSql(`alter table "survey_answer" add constraint "survey_answer_question_id_foreign" foreign key ("question_id") references "survey_question" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "message" alter column "conversation_id" type text using ("conversation_id"::text);`);

    this.addSql(`alter table "message" drop constraint "message_conversation_id_foreign";`);

    this.addSql(`alter table "survey_answer" alter column "question_id" type text using ("question_id"::text);`);

    this.addSql(`alter table "survey_answer" drop constraint "survey_answer_question_id_foreign";`);

    this.addSql(`alter table "message" add column "conversationId" uuid not null;`);
    this.addSql(`alter table "message" alter column "conversation_id" type varchar(255) using ("conversation_id"::varchar(255));`);
    this.addSql(`alter table "message" add constraint "message_conversationId_foreign" foreign key ("conversationId") references "conversation" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "survey_answer" add column "questionId" uuid not null;`);
    this.addSql(`alter table "survey_answer" alter column "question_id" type varchar(255) using ("question_id"::varchar(255));`);
    this.addSql(`alter table "survey_answer" add constraint "survey_answer_questionId_foreign" foreign key ("questionId") references "survey_question" ("id") on update cascade on delete cascade;`);
  }

}
