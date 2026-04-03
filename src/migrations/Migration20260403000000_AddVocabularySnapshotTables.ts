import { Migration } from '@mikro-orm/migrations';

export class Migration20260403000000_AddVocabularySnapshotTables extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "vocab_dictionary" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "is_active" boolean not null default true, "version" text not null, "source" text not null, "status" text not null default 'active', "built_at" timestamptz null, "stats" jsonb not null, "snapshot_payload" jsonb not null, constraint "vocab_dictionary_pkey" primary key ("id"));`);
    this.addSql(`create unique index "vocab_dictionary_version_unique" on "vocab_dictionary" ("version");`);
    this.addSql(`create index "vocab_dictionary_is_active_index" on "vocab_dictionary" ("is_active");`);

    this.addSql(`create table "vocab_term" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "is_active" boolean not null default true, "dictionary_id" uuid not null, "entity_type" text not null, "canonical" text not null, "normalized_canonical" text not null, "priority" int not null default 0, "confidence" double precision not null default 1, constraint "vocab_term_pkey" primary key ("id"));`);
    this.addSql(`create index "vocab_term_dictionary_entity_type_canonical_index" on "vocab_term" ("dictionary_id", "entity_type", "canonical");`);
    this.addSql(`alter table "vocab_term" add constraint "vocab_term_dictionary_id_foreign" foreign key ("dictionary_id") references "vocab_dictionary" ("id") on update cascade on delete cascade;`);

    this.addSql(`create table "vocab_alias" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "is_active" boolean not null default true, "term_id" uuid not null, "alias_text" text not null, "normalized_alias" text not null, "confidence" double precision not null default 0.95, "alias_kind" text not null default 'synonym', constraint "vocab_alias_pkey" primary key ("id"));`);
    this.addSql(`create index "vocab_alias_normalized_alias_index" on "vocab_alias" ("normalized_alias");`);
    this.addSql(`alter table "vocab_alias" add constraint "vocab_alias_term_id_foreign" foreign key ("term_id") references "vocab_term" ("id") on update cascade on delete cascade;`);

    this.addSql(`create table "vocab_age_bucket" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "is_active" boolean not null default true, "term_id" uuid not null, "label" text not null, "min_age" int not null, "max_age" int not null, "priority" int not null default 0, constraint "vocab_age_bucket_pkey" primary key ("id"));`);
    this.addSql(`create index "vocab_age_bucket_min_age_max_age_index" on "vocab_age_bucket" ("min_age", "max_age");`);
    this.addSql(`alter table "vocab_age_bucket" add constraint "vocab_age_bucket_term_id_foreign" foreign key ("term_id") references "vocab_term" ("id") on update cascade on delete cascade;`);

    this.addSql(`create table "vocab_phrase_rule" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null, "updated_at" timestamptz not null, "is_active" boolean not null default true, "dictionary_id" uuid not null, "phrase" text not null, "normalized_phrase" text not null, "rule_type" text not null, "scope" text not null default 'global', "confidence" double precision not null default 1, constraint "vocab_phrase_rule_pkey" primary key ("id"));`);
    this.addSql(`create index "vocab_phrase_rule_normalized_phrase_index" on "vocab_phrase_rule" ("normalized_phrase");`);
    this.addSql(`alter table "vocab_phrase_rule" add constraint "vocab_phrase_rule_dictionary_id_foreign" foreign key ("dictionary_id") references "vocab_dictionary" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "vocab_phrase_rule" cascade;`);
    this.addSql(`drop table if exists "vocab_age_bucket" cascade;`);
    this.addSql(`drop table if exists "vocab_alias" cascade;`);
    this.addSql(`drop table if exists "vocab_term" cascade;`);
    this.addSql(`drop table if exists "vocab_dictionary" cascade;`);
  }

}
