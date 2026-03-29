import { Injectable, Logger } from '@nestjs/common';
import { tool, Tool, Output } from 'ai';
import { MasterDataService } from 'src/infrastructure/servicies/master-data.service';
import { encodeToolOutput } from '../toon-encoder.util';
import * as z from 'zod';
import { aiModel, aiModelForConversationAnalysis } from 'src/chatbot/ai-model';
import { objectGenerationFromMessagesToResultWithErrorHandler } from 'src/chatbot/chatbot';
import { INTERNAL_NORMALIZATION_SYSTEM_PROMPT } from 'src/application/constant/prompts/system.prompt';

@Injectable()
export class MasterDataTool {
    private readonly logger = new Logger(MasterDataTool.name);

    constructor(private readonly masterDataService: MasterDataService) { }

    searchMasterData: Tool = tool({
        description: 'Advanced search for Brands, Categories, Scent Notes, Olfactory Families, Attribute Values or Product Names. Supports per-keyword type targeting and automatic semantic normalization. Results are TOON-encoded.',
        inputSchema: z.object({
            searchInfos: z.array(z.object({
                keyword: z.string(),
                types: z.array(z.enum(['brand', 'category', 'note', 'family', 'attribute', 'product', 'all']))
            })).describe('List of search terms with their potential database types.'),
        }),
        execute: async ({ searchInfos }) => {
            this.logger.log(`[searchMasterData] searchInfos: ${JSON.stringify(searchInfos)}`);

            const finalResults: any = {
                brands: [], categories: [], notes: [], families: [], attributes: [], products: []
            };

            const foundKeywords = new Set<string>();

            // --- PHASE 1: DIRECT SEARCH ---
            const performSearch = async (kw: string, targetTypes: string[]) => {
                const types = targetTypes.includes('all') ? ['brand', 'category', 'note', 'family', 'attribute', 'product'] : targetTypes;
                const pList: Promise<void>[] = [];
                if (types.includes('brand')) pList.push(this.masterDataService.searchBrands(kw).then(res => { if (res.length > 0) { finalResults.brands.push(...res); foundKeywords.add(kw); } }));
                if (types.includes('category')) pList.push(this.masterDataService.searchCategories(kw).then(res => { if (res.length > 0) { finalResults.categories.push(...res); foundKeywords.add(kw); } }));
                if (types.includes('note')) pList.push(this.masterDataService.searchScentNotes(kw).then(res => { if (res.length > 0) { finalResults.notes.push(...res); foundKeywords.add(kw); } }));
                if (types.includes('family')) pList.push(this.masterDataService.searchOlfactoryFamilies(kw).then(res => { if (res.length > 0) { finalResults.families.push(...res); foundKeywords.add(kw); } }));
                if (types.includes('attribute')) pList.push(this.masterDataService.searchAttributeValues(kw).then(res => { if (res.length > 0) { finalResults.attributes.push(...res); foundKeywords.add(kw); } }));
                if (types.includes('product')) pList.push(this.masterDataService.searchProducts(kw).then(res => { if (res.length > 0) { finalResults.products.push(...res); foundKeywords.add(kw); } }));
                await Promise.all(pList);
            };

            await Promise.all(searchInfos.map(info => performSearch(info.keyword, info.types)));

            // --- PHASE 2: STRUCTURED SEMANTIC NORMALIZATION ---
            const missingInfos = searchInfos.filter(info => !foundKeywords.has(info.keyword));

            if (missingInfos.length > 0) {
                const missingKeywords = missingInfos.map(i => i.keyword);
                this.logger.log(`[searchMasterData] Normalizing missing keywords: ${missingKeywords.join(', ')}`);

                const context = await this.getNormalizationContext();
                const prompt = INTERNAL_NORMALIZATION_SYSTEM_PROMPT
                    .replace('{{CONTEXT}}', JSON.stringify(context, null, 2))
                    .replace('{{KEYWORDS}}', missingKeywords.join(', '));

                const normalizationResult = await objectGenerationFromMessagesToResultWithErrorHandler<{ mappings: { original: string, corrected: string | null }[] }>(
                    aiModelForConversationAnalysis,
                    [{ id: Date.now().toString(), role: 'user', parts: [{ type: 'text', text: prompt }] }],
                    "Bạn là chuyên gia chuẩn hóa dữ liệu nước hoa.",
                    z.object({
                        mappings: z.array(z.object({
                            original: z.string(),
                            corrected: z.string().nullable()
                        }))
                    })
                    ,
                    "Failed to generate normalization object"
                );

                if (normalizationResult && (normalizationResult as any).mappings) {
                    const reSearchTasks: Promise<void>[] = [];
                    for (const mapping of (normalizationResult as any).mappings) {
                        if (mapping.corrected) {
                            this.logger.log(`[searchMasterData] Re-searching normalized: ${mapping.original} -> ${mapping.corrected}`);
                            // Reuse types from original searchInfo if possible
                            const originalInfo = searchInfos.find(i => i.keyword === mapping.original);
                            reSearchTasks.push(performSearch(mapping.corrected, originalInfo?.types || ['all']));
                        }
                    }
                    await Promise.all(reSearchTasks);
                }
            }

            // --- PHASE 3: DEDUPLICATION & RETURN ---
            const deduplicate = (arr: any[]) => {
                const seen = new Set();
                return arr.filter(item => {
                    const id = item.Id || item.id;
                    if (seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });
            };

            return encodeToolOutput({
                brands: deduplicate(finalResults.brands),
                categories: deduplicate(finalResults.categories),
                notes: deduplicate(finalResults.notes),
                families: deduplicate(finalResults.families),
                attributes: deduplicate(finalResults.attributes),
                products: deduplicate(finalResults.products)
            });
        }
    });

    private async getNormalizationContext() {
        const [notes, families, attributes] = await Promise.all([
            this.masterDataService.searchScentNotes('').then(res => res.map(x => x.Name)),
            this.masterDataService.searchOlfactoryFamilies('').then(res => res.map(x => x.Name)),
            this.masterDataService.getAttributesWithValues().then(res => res.map(a => ({
                name: a.Name,
                values: a.AttributeValues.map(v => v.Value)
            })))
        ]);

        return { notes, families, attributes };
    }

    getAvailableAttributes: Tool = tool({
        description: 'Get all available product attributes and their possible values (e.g., Occasions, Seasons, Age groups). Results are TOON-encoded.',
        inputSchema: z.object({}),
        execute: async () => {
            this.logger.log(`[getAvailableAttributes] called`);
            const results = await this.masterDataService.getAttributesWithValues();
            return encodeToolOutput(results);
        }
    });
}
