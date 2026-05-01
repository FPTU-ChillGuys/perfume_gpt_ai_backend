import { Migration } from '@mikro-orm/migrations';

export class Migration20260403143000_AddVietnameseGenderAliases extends Migration {
  override async up(): Promise<void> {
    // 1) Seed Vietnamese aliases into vocab_alias for existing gender terms.
    this.addSql(`
      insert into "vocab_alias" ("id", "created_at", "updated_at", "is_active", "term_id", "alias_text", "normalized_alias", "confidence", "alias_kind")
      select
        gen_random_uuid(),
        now(),
        now(),
        true,
        t."id",
        v.alias_text,
        v.normalized_alias,
        0.97,
        'gender_vi_seed'
      from "vocab_term" t
      join (values
        ('male', 'nam', 'nam'),
        ('male', 'cho nam', 'cho nam'),
        ('female', 'nữ', 'nu'),
        ('female', 'nu', 'nu'),
        ('female', 'cho nữ', 'cho nu'),
        ('female', 'cho nu', 'cho nu'),
        ('unisex', 'cho cả nam và nữ', 'cho ca nam va nu'),
        ('unisex', 'cho ca nam va nu', 'cho ca nam va nu'),
        ('unisex', 'trung tính', 'trung tinh'),
        ('unisex', 'trung tinh', 'trung tinh')
      ) as v(canonical, alias_text, normalized_alias)
        on t."entity_type" = 'gender'
       and t."normalized_canonical" = v.canonical
      where not exists (
        select 1
        from "vocab_alias" a
        where a."term_id" = t."id"
          and a."normalized_alias" = v.normalized_alias
      );
    `);

    // 2) Patch snapshot payload so runtime dictionary loaded from snapshot includes Vietnamese gender aliases.
    this.addSql(`
      do $$
      begin
        update "vocab_dictionary"
        set "snapshot_payload" = jsonb_set(
          jsonb_set(
            jsonb_set(
              "snapshot_payload",
              '{entityDictionary,gender,male}',
              coalesce("snapshot_payload" #> '{entityDictionary,gender,male}', '[]'::jsonb)
                || '["nam", "cho nam"]'::jsonb,
              true
            ),
            '{entityDictionary,gender,female}',
            coalesce("snapshot_payload" #> '{entityDictionary,gender,female}', '[]'::jsonb)
              || '["nu", "nữ", "cho nu", "cho nữ"]'::jsonb,
            true
          ),
          '{entityDictionary,gender,unisex}',
          coalesce("snapshot_payload" #> '{entityDictionary,gender,unisex}', '[]'::jsonb)
            || '["cho ca nam va nu", "cho cả nam và nữ", "trung tinh", "trung tính"]'::jsonb,
          true
        )
        where "snapshot_payload" ? 'entityDictionary';
      end $$;
    `);
  }

  override async down(): Promise<void> {
    // Remove seeded aliases by alias_kind marker.
    this.addSql(`
      delete from "vocab_alias"
      where "alias_kind" = 'gender_vi_seed';
    `);

    // Remove seeded values from snapshot payload arrays.
    this.addSql(`
      do $$
      begin
        update "vocab_dictionary"
        set "snapshot_payload" = jsonb_set(
          jsonb_set(
            jsonb_set(
              "snapshot_payload",
              '{entityDictionary,gender,male}',
              (
                select coalesce(jsonb_agg(to_jsonb(x.value)), '[]'::jsonb)
                from jsonb_array_elements_text(coalesce("snapshot_payload" #> '{entityDictionary,gender,male}', '[]'::jsonb)) as x(value)
                where x.value not in ('nam', 'cho nam')
              ),
              true
            ),
            '{entityDictionary,gender,female}',
            (
              select coalesce(jsonb_agg(to_jsonb(x.value)), '[]'::jsonb)
              from jsonb_array_elements_text(coalesce("snapshot_payload" #> '{entityDictionary,gender,female}', '[]'::jsonb)) as x(value)
              where x.value not in ('nu', 'nữ', 'cho nu', 'cho nữ')
            ),
            true
          ),
          '{entityDictionary,gender,unisex}',
          (
            select coalesce(jsonb_agg(to_jsonb(x.value)), '[]'::jsonb)
            from jsonb_array_elements_text(coalesce("snapshot_payload" #> '{entityDictionary,gender,unisex}', '[]'::jsonb)) as x(value)
            where x.value not in ('cho ca nam va nu', 'cho cả nam và nữ', 'trung tinh', 'trung tính')
          ),
          true
        )
        where "snapshot_payload" ? 'entityDictionary';
      end $$;
    `);
  }
}
