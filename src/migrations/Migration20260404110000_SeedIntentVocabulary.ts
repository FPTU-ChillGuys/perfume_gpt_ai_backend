import { Migration } from '@mikro-orm/migrations';

export class Migration20260404110000_SeedIntentVocabulary extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      DO $$ 
      DECLARE 
        v_dict_id uuid;
        v_recommend_term_id uuid;
        v_consult_term_id uuid;
        v_task_term_id uuid;
      BEGIN
        -- Get the active dictionary ID
        SELECT id INTO v_dict_id FROM vocab_dictionary WHERE is_active = true ORDER BY created_at DESC LIMIT 1;
        
        IF v_dict_id IS NOT NULL THEN
          -- Seed Recommend Intent
          IF NOT EXISTS (SELECT 1 FROM vocab_term WHERE canonical = 'recommend' AND entity_type = 'intent' AND dictionary_id = v_dict_id) THEN
            v_recommend_term_id := gen_random_uuid();
            INSERT INTO vocab_term (id, dictionary_id, entity_type, canonical, normalized_canonical, priority, confidence, is_active, created_at, updated_at)
            VALUES (v_recommend_term_id, v_dict_id, 'intent', 'recommend', 'recommend', 10, 1, true, now(), now());

            INSERT INTO vocab_alias (id, term_id, alias_text, normalized_alias, confidence, alias_kind, is_active, created_at, updated_at)
            VALUES 
              (gen_random_uuid(), v_recommend_term_id, 'tư vấn', 'tu van', 1, 'synonym', true, now(), now()),
              (gen_random_uuid(), v_recommend_term_id, 'gợi ý', 'goi y', 1, 'synonym', true, now(), now()),
              (gen_random_uuid(), v_recommend_term_id, 'đề xuất', 'de xuat', 1, 'synonym', true, now(), now()),
              (gen_random_uuid(), v_recommend_term_id, 'chọn cho tôi', 'chon cho toi', 1, 'synonym', true, now(), now()),
              (gen_random_uuid(), v_recommend_term_id, 'giới thiệu', 'gioi thieu', 1, 'synonym', true, now(), now()),
              (gen_random_uuid(), v_recommend_term_id, 'suggest', 'suggest', 1, 'synonym', true, now(), now()),
              (gen_random_uuid(), v_recommend_term_id, 'khuyên', 'khuyen', 1, 'synonym', true, now(), now()),
              (gen_random_uuid(), v_recommend_term_id, 'recomen', 'recomen', 1, 'synonym', true, now(), now()),
              (gen_random_uuid(), v_recommend_term_id, 'recomand', 'recomand', 1, 'synonym', true, now(), now());
          END IF;

          -- Seed Consult Intent
          IF NOT EXISTS (SELECT 1 FROM vocab_term WHERE canonical = 'consult' AND entity_type = 'intent' AND dictionary_id = v_dict_id) THEN
            v_consult_term_id := gen_random_uuid();
            INSERT INTO vocab_term (id, dictionary_id, entity_type, canonical, normalized_canonical, priority, confidence, is_active, created_at, updated_at)
            VALUES (v_consult_term_id, v_dict_id, 'intent', 'consult', 'consult', 10, 1, true, now(), now());

            INSERT INTO vocab_alias (id, term_id, alias_text, normalized_alias, confidence, alias_kind, is_active, created_at, updated_at)
            VALUES 
              (gen_random_uuid(), v_consult_term_id, 'so sánh', 'so sanh', 1, 'synonym', true, now(), now()),
              (gen_random_uuid(), v_consult_term_id, 'compare', 'compare', 1, 'synonym', true, now(), now());
          END IF;

          -- Seed Task Intent
          IF NOT EXISTS (SELECT 1 FROM vocab_term WHERE canonical = 'task' AND entity_type = 'intent' AND dictionary_id = v_dict_id) THEN
            v_task_term_id := gen_random_uuid();
            INSERT INTO vocab_term (id, dictionary_id, entity_type, canonical, normalized_canonical, priority, confidence, is_active, created_at, updated_at)
            VALUES (v_task_term_id, v_dict_id, 'intent', 'task', 'task', 10, 1, true, now(), now());

            INSERT INTO vocab_alias (id, term_id, alias_text, normalized_alias, confidence, alias_kind, is_active, created_at, updated_at)
            VALUES 
              (gen_random_uuid(), v_task_term_id, 'mua', 'mua', 1, 'synonym', true, now(), now()),
              (gen_random_uuid(), v_task_term_id, 'đặt hàng', 'dat hang', 1, 'synonym', true, now(), now()),
              (gen_random_uuid(), v_task_term_id, 'thêm vào', 'them vao', 1, 'synonym', true, now(), now()),
              (gen_random_uuid(), v_task_term_id, 'giỏ hàng', 'gio hang', 1, 'synonym', true, now(), now()),
              (gen_random_uuid(), v_task_term_id, 'cart', 'cart', 1, 'synonym', true, now(), now()),
              (gen_random_uuid(), v_task_term_id, 'buy', 'buy', 1, 'synonym', true, now(), now());
          END IF;
        END IF;
      END $$;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      DO $$
      DECLARE
        v_dict_id uuid;
      BEGIN
        SELECT id INTO v_dict_id FROM vocab_dictionary WHERE is_active = true ORDER BY created_at DESC LIMIT 1;
        
        IF v_dict_id IS NOT NULL THEN
          DELETE FROM vocab_alias WHERE term_id IN (SELECT id FROM vocab_term WHERE entity_type = 'intent' AND dictionary_id = v_dict_id);
          DELETE FROM vocab_term WHERE entity_type = 'intent' AND dictionary_id = v_dict_id;
        END IF;
      END $$;
    `);
  }
}
