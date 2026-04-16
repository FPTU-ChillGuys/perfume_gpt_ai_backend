import { Injectable, Logger } from '@nestjs/common';
import { tool, Tool, Output } from 'ai';
import { MasterDataService } from 'src/infrastructure/domain/common/master-data.service';
import { encodeToolOutput } from '../utils/toon-encoder.util';
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
            const keywordToLabelsMap = new Map<string, Set<string>>();

            const getLabelsForRes = (res: any[]) => res.map(item => item.Name || item.Value || item.id || item.Id);

            // --- PHASE 1: DIRECT SEARCH ---
            const performSearch = async (kw: string, targetTypes: string[], originalKeyword?: string) => {
                const types = targetTypes.includes('all') ? ['brand', 'category', 'note', 'family', 'attribute', 'product'] : targetTypes;
                const pList: Promise<void>[] = [];

                const trackResult = (res: any[], kwUsed: string) => {
                    if (res.length > 0) {
                        foundKeywords.add(kwUsed);
                        if (originalKeyword) {
                            if (!keywordToLabelsMap.has(originalKeyword)) {
                                keywordToLabelsMap.set(originalKeyword, new Set());
                            }
                            getLabelsForRes(res).forEach(l => keywordToLabelsMap.get(originalKeyword)!.add(l));
                        }
                    }
                };

                if (types.includes('brand')) pList.push(this.masterDataService.searchBrands(kw).then(res => { if (res.length > 0) { finalResults.brands.push(...res); trackResult(res, kw); } }));
                if (types.includes('category')) pList.push(this.masterDataService.searchCategories(kw).then(res => { if (res.length > 0) { finalResults.categories.push(...res); trackResult(res, kw); } }));
                if (types.includes('note')) pList.push(this.masterDataService.searchScentNotes(kw).then(res => { if (res.length > 0) { finalResults.notes.push(...res); trackResult(res, kw); } }));
                if (types.includes('family')) pList.push(this.masterDataService.searchOlfactoryFamilies(kw).then(res => { if (res.length > 0) { finalResults.families.push(...res); trackResult(res, kw); } }));
                if (types.includes('attribute')) pList.push(this.masterDataService.searchAttributeValues(kw).then(res => { if (res.length > 0) { finalResults.attributes.push(...res); trackResult(res, kw); } }));
                if (types.includes('product')) pList.push(this.masterDataService.searchProducts(kw).then(res => { if (res.length > 0) { finalResults.products.push(...res); trackResult(res, kw); } }));
                await Promise.all(pList);
            };

            await Promise.all(searchInfos.map(info => performSearch(info.keyword, info.types, info.keyword)));

            // --- PHASE 2: STRUCTURED SEMANTIC NORMALIZATION ---
            const missingInfos = searchInfos.filter(info => !foundKeywords.has(info.keyword));

            if (missingInfos.length > 0) {
                const missingKeywords = missingInfos.map(i => i.keyword);
                this.logger.log(`[searchMasterData] Normalizing missing keywords: ${missingKeywords.join(', ')}`);

                const context = await this.getNormalizationContext();
                const prompt = INTERNAL_NORMALIZATION_SYSTEM_PROMPT
                    .replace('{{CONTEXT}}', JSON.stringify(context, null, 2))
                    .replace('{{KEYWORDS}}', missingKeywords.join(', '));

                const normalizationResult = await objectGenerationFromMessagesToResultWithErrorHandler<{ mappings: { original: string, corrected: string | string[] | null }[] }>(
                    aiModelForConversationAnalysis,
                    [{ id: Date.now().toString(), role: 'user', parts: [{ type: 'text', text: prompt }] }],
                    "Bạn là chuyên gia chuẩn hóa dữ liệu nước hoa.",
                    z.object({
                        mappings: z.array(z.object({
                            original: z.string(),
                            corrected: z.union([z.string(), z.array(z.string())]).nullable()
                        }))
                    })
                    ,
                    "Failed to generate normalization object"
                );

                if (normalizationResult && (normalizationResult as any).mappings) {
                    const reSearchTasks: Promise<void>[] = [];
                    for (const mapping of (normalizationResult as any).mappings) {
                        if (mapping.corrected) {
                            const correctedTerms = Array.isArray(mapping.corrected) ? mapping.corrected : [mapping.corrected];
                            const originalInfo = searchInfos.find(i => i.keyword === mapping.original);

                            for (const term of correctedTerms) {
                                // CRITICAL: Validate that normalized term actually exists in context
                                // Skip if term is too generic or doesn't match any real data
                                if (this.shouldSkipNormalizedTerm(term, mapping.original)) {
                                    this.logger.log(`[searchMasterData] SKIP normalized term (too generic/no match): ${mapping.original} -> ${term}`);
                                    continue;
                                }

                                this.logger.log(`[searchMasterData] Re-searching normalized: ${mapping.original} -> ${term}`);
                                reSearchTasks.push(performSearch(term, originalInfo?.types || ['all'], mapping.original));
                            }
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

            const getLabels = (arr: any[]) => arr.map(item => item.Name || item.Value || item.id || item.Id);

            const keywordMappings = Array.from(keywordToLabelsMap.entries()).map(([kw, labels]) => ({
                original: kw,
                corrected: Array.from(labels)
            }));

            return {
                ...encodeToolOutput({
                    brands: deduplicate(finalResults.brands),
                    categories: deduplicate(finalResults.categories),
                    notes: deduplicate(finalResults.notes),
                    families: deduplicate(finalResults.families),
                    attributes: deduplicate(finalResults.attributes),
                    products: deduplicate(finalResults.products)
                }),
                // keywordMappings giúp AI biết nhãn nào thuộc về cùng 1 intent để gộp vào mảng OR
                keywordMappings,
                // summaryFoundLabels duy trì cho backward compatibility
                summaryFoundLabels: {
                    brands: Array.from(new Set(getLabels(finalResults.brands))),
                    categories: Array.from(new Set(getLabels(finalResults.categories))),
                    notes: Array.from(new Set(getLabels(finalResults.notes))),
                    families: Array.from(new Set(getLabels(finalResults.families))),
                    attributes: Array.from(new Set(getLabels(finalResults.attributes))),
                    products: Array.from(new Set(getLabels(finalResults.products)))
                }
            };
        }
    });

    getProductNormalizationContext: Tool = tool({
        description: 'Get enriched normalization context for perfume search intent. Includes notes, families, attributes, genders, origins, release years, concentration names, variant types, longevity/sillage levels, and sample product metadata.',
        inputSchema: z.object({}),
        execute: async () => {
            this.logger.log('[getProductNormalizationContext] called');
            const context = await this.getNormalizationContext();

            return {
                success: true,
                ...encodeToolOutput(context),
                contextSummary: {
                    notes: context.notes.length,
                    families: context.families.length,
                    attributes: context.attributes.length,
                    genders: context.genders.length,
                    origins: context.origins.length,
                    releaseYears: context.releaseYears.length,
                    concentrationNames: context.concentrationNames.length,
                    variantTypes: context.variantTypes.length,
                    sampleProducts: context.sampleProducts.length
                }
            };
        }
    });

    private async getNormalizationContext() {
        return this.masterDataService.getNormalizationContextData();
    }

    /**
     * CRITICAL: Skip normalized terms that are too generic or don't match real data.
     * This prevents AI from hallucinating irrelevant keywords like "and", "Sweet", "Woody", "Fruity"
     * when they don't actually exist in the context.
     */
    private shouldSkipNormalizedTerm(term: string, original: string): boolean {
        // Skip English words that don't make sense in Vietnamese context
        const englishOnlyPattern = /^[a-zA-Z\s]+$/;
        if (englishOnlyPattern.test(term) && !['Floral', 'Woody', 'Fresh', 'Oriental', 'Fruity', 'Sweet'].includes(term)) {
            // Skip generic English words unless they're known perfume categories
            this.logger.log(`[searchMasterData] SKIP: English term "${term}" not in known categories`);
            return true;
        }

        // Skip very generic terms that would match too many products
        const genericTerms = ['and', 'the', 'a', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'yes', 'ok', 'okay'];
        if (genericTerms.includes(term.toLowerCase())) {
            this.logger.log(`[searchMasterData] SKIP: Generic term "${term}"`);
            return true;
        }

        // Skip terms that are too short (likely AI hallucination)
        if (term.length <= 2 && !['US', 'UK', 'EU'].includes(term)) {
            this.logger.log(`[searchMasterData] SKIP: Too short term "${term}"`);
            return true;
        }

        // Skip if the normalized term is the same as original (AI didn't actually normalize)
        if (term.toLowerCase() === original.toLowerCase()) {
            this.logger.log(`[searchMasterData] SKIP: No normalization occurred "${original}" -> "${term}"`);
            return true;
        }

        return false;
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
