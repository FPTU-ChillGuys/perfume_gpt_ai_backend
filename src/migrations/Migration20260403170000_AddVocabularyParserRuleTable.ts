import { Migration } from '@mikro-orm/migrations';

export class Migration20260403170000_AddVocabularyParserRuleTable extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "vocab_parser_rule" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "is_active" boolean not null default true, "dictionary_id" uuid not null, "rule_group" text not null, "pattern" text not null, "is_regex" boolean not null default true, "priority" int not null default 0, constraint "vocab_parser_rule_pkey" primary key ("id"));`
    );
    this.addSql(
      `create index "vocab_parser_rule_dictionary_rule_group_priority_index" on "vocab_parser_rule" ("dictionary_id", "rule_group", "priority");`
    );
    this.addSql(
      `alter table "vocab_parser_rule" add constraint "vocab_parser_rule_dictionary_id_foreign" foreign key ("dictionary_id") references "vocab_dictionary" ("id") on update cascade on delete cascade;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "vocab_parser_rule" cascade;`);
  }
}
