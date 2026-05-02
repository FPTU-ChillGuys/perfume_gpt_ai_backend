import { Injectable, Logger } from '@nestjs/common';
import { objectGenerationFromMessagesToResultWithErrorHandler } from 'src/chatbot/chatbot';
import { aiModelForConversationAnalysis } from 'src/chatbot/ai-model';
import {
  EntityDictionary,
  EntityType
} from 'src/domain/types/dictionary.types';
import { PromptLoaderService } from 'src/infrastructure/domain/utils/prompt-loader.service';
import { z } from 'zod';

const BATCH_SIZE = 20;
const MAX_TOKENS = 800;
const TIMEOUT_MS = 15000;

const aliasResponseSchema = z.object({
  items: z.array(
    z.object({
      canonical: z.string(),
      aliases: z.array(z.string())
    })
  )
});

const SYSTEM_PROMPT = `Bạn là chuyên gia nước hoa Việt Nam. Với mỗi thuật ngữ, hãy tạo 2-5 alias/tên gọi khác mà người Việt hay dùng (có thể gồm tên tiếng Anh, tên gọi tắt, viết sai chính tả phổ biến). Trả về JSON với key "items" chứa mảng {canonical, aliases}. Ví dụ: {"items": [{"canonical": "Christian Dior", "aliases": ["dior", "cd", "christiandior"]}]}`;

@Injectable()
export class AliasAiEnrichmentProcessor {
  private readonly logger = new Logger(AliasAiEnrichmentProcessor.name);

  constructor(private readonly promptLoader: PromptLoaderService) {}

  async enrich(
    entityType: EntityType,
    canonicals: string[]
  ): Promise<Record<string, string[]>> {
    const enriched: Record<string, string[]> = {};
    const batchStart = Date.now();

    for (let i = 0; i < canonicals.length; i += BATCH_SIZE) {
      const batch = canonicals.slice(i, i + BATCH_SIZE);
      try {
        const result = await this.callAi(batch);
        for (const item of result.items) {
          if (item.aliases.length > 0) {
            enriched[item.canonical] = item.aliases;
            this.logger.debug(
              this.promptLoader.get('log.alias_enrich.ai.detail', {
                ENTITY_TYPE: entityType,
                CANONICAL: item.canonical,
                COUNT: String(item.aliases.length),
                LIST: item.aliases.join(', ')
              })
            );
          }
        }
      } catch (err) {
        this.logger.warn(
          `[AliasAI] Batch failed for ${entityType}: ${(err as Error).message}`
        );
      }
    }

    const totalAliasesAdded = Object.values(enriched).reduce(
      (sum, a) => sum + a.length,
      0
    );
    this.logger.log(
      this.promptLoader.get('log.alias_enrich.ai.type', {
        ENTITY_TYPE: entityType,
        CANONICALS: String(canonicals.length),
        ALIASES: String(totalAliasesAdded),
        ELAPSED: String(Date.now() - batchStart)
      })
    );

    return enriched;
  }

  private async callAi(
    batch: string[]
  ): Promise<{ items: Array<{ canonical: string; aliases: string[] }> }> {
    const userPrompt = `Entity type: perfume ${batch.length} terms.\n${batch.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nGenerate aliases for each.`;

    const result = await objectGenerationFromMessagesToResultWithErrorHandler<{
      items: Array<{ canonical: string; aliases: string[] }>;
    }>(
      aiModelForConversationAnalysis,
      [
        {
          id: Date.now().toString(),
          role: 'system',
          parts: [{ type: 'text', text: SYSTEM_PROMPT }]
        },
        {
          id: (Date.now() + 1).toString(),
          role: 'user',
          parts: [{ type: 'text', text: userPrompt }]
        }
      ],
      SYSTEM_PROMPT,
      aliasResponseSchema,
      'Failed to generate alias enrichment'
    );

    if (!result || !(result as any).items) {
      return { items: [] };
    }

    return result as { items: Array<{ canonical: string; aliases: string[] }> };
  }
}