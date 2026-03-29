import { Injectable, Logger } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { MasterDataService } from 'src/infrastructure/servicies/master-data.service';
import { encodeToolOutput } from '../toon-encoder.util';
import * as z from 'zod';

@Injectable()
export class MasterDataTool {
    private readonly logger = new Logger(MasterDataTool.name);

    constructor(private readonly masterDataService: MasterDataService) { }

    searchMasterData: Tool = tool({
        description: 'Search for Brands, Categories, Scent Notes, Olfactory Families, Attribute Values or Product Names. Use keywords array for multi-term search (e.g., ["tươi mát", "trẻ trung"]). Results are TOON-encoded.',
        inputSchema: z.object({
            keywords: z.union([z.string(), z.array(z.string())]),
            type: z.enum(['brand', 'category', 'note', 'family', 'attribute', 'product', 'all']).optional().default('all'),
        }),
        execute: async ({ keywords, type }) => {
            const keywordList = Array.isArray(keywords)
                ? keywords
                : keywords.split(',').map(s => s.trim()).filter(s => s.length > 0);

            this.logger.log(`[searchMasterData] keywords: ${keywordList.join(', ')}, type: ${type}`);

            const results: any = {
                brands: [], categories: [], notes: [], families: [], attributes: [], products: []
            };

            const allSearches: Promise<void>[] = [];

            for (const kw of keywordList) {
                if (type === 'all' || type === 'brand') allSearches.push(this.masterDataService.searchBrands(kw).then(res => { results.brands.push(...res); }));
                if (type === 'all' || type === 'category') allSearches.push(this.masterDataService.searchCategories(kw).then(res => { results.categories.push(...res); }));
                if (type === 'all' || type === 'note') allSearches.push(this.masterDataService.searchScentNotes(kw).then(res => { results.notes.push(...res); }));
                if (type === 'all' || type === 'family') allSearches.push(this.masterDataService.searchOlfactoryFamilies(kw).then(res => { results.families.push(...res); }));
                if (type === 'all' || type === 'attribute') allSearches.push(this.masterDataService.searchAttributeValues(kw).then(res => { results.attributes.push(...res); }));
                if (type === 'all' || type === 'product') allSearches.push(this.masterDataService.searchProducts(kw).then(res => { results.products.push(...res); }));
            }

            await Promise.all(allSearches);

            // Deduplicate results by ID
            const deduplicate = (arr: any[]) => {
                const seen = new Set();
                return arr.filter(item => {
                    const id = item.Id || item.id;
                    if (seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });
            };

            const finalResults = {
                brands: deduplicate(results.brands),
                categories: deduplicate(results.categories),
                notes: deduplicate(results.notes),
                families: deduplicate(results.families),
                attributes: deduplicate(results.attributes),
                products: deduplicate(results.products)
            };

            this.logger.debug(`[searchMasterData] Found ${Object.values(finalResults).flat().length} total matching items.`);

            return encodeToolOutput(finalResults);
        }
    });

    normalizeKeyword: Tool = tool({
        description: 'Normalize or correct a misspelled/fuzzy keyword by cross-referencing with database entities. Use this when searchMasterData returns no results. Results are TOON-encoded.',
        inputSchema: z.object({
            keyword: z.string(),
            type: z.enum(['brand', 'category', 'note', 'family', 'attribute']),
        }),
        execute: async ({ keyword, type }) => {
            this.logger.log(`[normalizeKeyword] keyword: \${keyword}, type: \${type}`);
            const results = await this.masterDataService.fuzzySearch(keyword, type);
            return encodeToolOutput(results);
        }
    });

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
