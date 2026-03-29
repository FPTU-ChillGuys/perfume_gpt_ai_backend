import { Injectable, Logger } from '@nestjs/common';
import { tool, Tool } from 'ai';
import { MasterDataService } from 'src/infrastructure/servicies/master-data.service';
import * as z from 'zod';

@Injectable()
export class MasterDataTool {
    private readonly logger = new Logger(MasterDataTool.name);

    constructor(private readonly masterDataService: MasterDataService) { }

    searchMasterData: Tool = tool({
        description: 'Search for Brands, Categories, Scent Notes, Olfactory Families, Attribute Values (Occasions, Seasons, etc.) or Product Names by keyword.',
        inputSchema: z.object({
            keyword: z.string(),
            type: z.enum(['brand', 'category', 'note', 'family', 'attribute', 'product', 'all']).optional().default('all'),
        }),
        execute: async ({ keyword, type }) => {
            this.logger.log(`[searchMasterData] keyword: ${keyword}, type: ${type}`);
            const results: any = {};

            const searches: Promise<void>[] = [];
            if (type === 'all' || type === 'brand') searches.push(this.masterDataService.searchBrands(keyword).then((res: any) => { results.brands = res; }));
            if (type === 'all' || type === 'category') searches.push(this.masterDataService.searchCategories(keyword).then((res: any) => { results.categories = res; }));
            if (type === 'all' || type === 'note') searches.push(this.masterDataService.searchScentNotes(keyword).then((res: any) => { results.notes = res; }));
            if (type === 'all' || type === 'family') searches.push(this.masterDataService.searchOlfactoryFamilies(keyword).then((res: any) => { results.families = res; }));
            if (type === 'all' || type === 'attribute') searches.push(this.masterDataService.searchAttributeValues(keyword).then((res: any) => { results.attributes = res; }));
            if (type === 'all' || type === 'product') searches.push(this.masterDataService.searchProducts(keyword).then((res: any) => { results.products = res; }));

            await Promise.all(searches);
            this.logger.debug(`[searchMasterData] results for "${keyword}": ${JSON.stringify(results, null, 2)}`);
            return results;
        }
    });

    getAvailableAttributes: Tool = tool({
        description: 'Get all available product attributes and their possible values (e.g., Occasions, Seasons, Age groups).',
        inputSchema: z.object({}),
        execute: async () => {
            this.logger.log(`[getAvailableAttributes] called`);
            return await this.masterDataService.getAttributesWithValues();
        }
    });
}
