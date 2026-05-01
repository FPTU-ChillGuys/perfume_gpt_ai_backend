import { Migration } from '@mikro-orm/migrations';

export class Migration20260403171500_SeedVocabularyParserRules extends Migration {
  override async up(): Promise<void> {
    this
      .addSql(`insert into "vocab_parser_rule" ("id", "created_at", "updated_at", "is_active", "dictionary_id", "rule_group", "pattern", "is_regex", "priority")
      select gen_random_uuid(), now(), now(), true, d."id", 'age_attribute_value', '(tuoi|thanh nien|nguoi lon|trung nien|thieu nien|teen)', true, 100
      from "vocab_dictionary" d
      where not exists (
        select 1 from "vocab_parser_rule" r
        where r."dictionary_id" = d."id"
          and r."rule_group" = 'age_attribute_value'
          and r."pattern" = '(tuoi|thanh nien|nguoi lon|trung nien|thieu nien|teen)'
      );`);

    this
      .addSql(`insert into "vocab_parser_rule" ("id", "created_at", "updated_at", "is_active", "dictionary_id", "rule_group", "pattern", "is_regex", "priority")
      select gen_random_uuid(), now(), now(), true, d."id", 'age_attribute_value', '(duoi|tren|tu)\\s*\\d{1,3}', true, 90
      from "vocab_dictionary" d
      where not exists (
        select 1 from "vocab_parser_rule" r
        where r."dictionary_id" = d."id"
          and r."rule_group" = 'age_attribute_value'
          and r."pattern" = '(duoi|tren|tu)\\s*\\d{1,3}'
      );`);

    this
      .addSql(`insert into "vocab_parser_rule" ("id", "created_at", "updated_at", "is_active", "dictionary_id", "rule_group", "pattern", "is_regex", "priority")
      select gen_random_uuid(), now(), now(), true, d."id", 'age_attribute_value', '\\d{1,3}\\s*(?:-|den)\\s*\\d{1,3}', true, 80
      from "vocab_dictionary" d
      where not exists (
        select 1 from "vocab_parser_rule" r
        where r."dictionary_id" = d."id"
          and r."rule_group" = 'age_attribute_value'
          and r."pattern" = '\\d{1,3}\\s*(?:-|den)\\s*\\d{1,3}'
      );`);
  }

  override async down(): Promise<void> {
    this.addSql(`delete from "vocab_parser_rule"
      where "rule_group" = 'age_attribute_value'
        and "pattern" in (
          '(tuoi|thanh nien|nguoi lon|trung nien|thieu nien|teen)',
          '(duoi|tren|tu)\\s*\\d{1,3}',
          '\\d{1,3}\\s*(?:-|den)\\s*\\d{1,3}'
        );`);
  }
}
