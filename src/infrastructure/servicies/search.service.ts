import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchQueryService } from './search-query.service';
import { SearchAiService } from './search-ai.service';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';

@Injectable()
export class SearchService {
    private readonly logger = new Logger(SearchService.name);
    private readonly indexName: string;

    constructor(
        private readonly elasticsearchService: ElasticsearchService,
        private readonly configService: ConfigService,
        private readonly searchQueryService: SearchQueryService,
        private readonly searchAiService: SearchAiService,
        private readonly prisma: PrismaService,
    ) {
        this.indexName = this.configService.get<string>('ELASTICSEARCH_INDEX_NAME') || 'products';
    }

    /**
     * Search products with semantic and layered search logic
     */
    async searchProducts(searchText: string, request: PagedAndSortedRequest) {
        if (!searchText) return { items: [], totalCount: 0 };

        let detectedSize: number | null = null;
        let genderFilter: string | undefined = undefined;
        let fromPrice: number | undefined = undefined;
        let toPrice: number | undefined = undefined;

        // --- Pre-processing Intent Detection ---
        let processedText = searchText.toLowerCase();

        // 1. Brand Correction Mapping
        const brandTypos: Record<string, string> = {
            chanell: 'chanel',
            diorr: 'dior',
            savuage: 'sauvage',
            explorerr: 'explorer',
            guci: 'gucci',
            versacee: 'versace',
            valentinno: 'valentino',
            lacostee: 'lacoste',
            ysl: 'yves saint laurent',
            ck: 'calvin klein',
        };

        for (const [typo, correction] of Object.entries(brandTypos)) {
            if (processedText.includes(typo)) {
                processedText = processedText.replace(new RegExp(typo, 'g'), correction);
            }
        }

        // 2. Gender Detection
        const noDiacritics = this.removeDiacritics(processedText);
        const hasMale = /(nam|men|con trai|dan ong)/i.test(noDiacritics);
        const hasFemale = /(nu|women|con gai|phu nu)/i.test(noDiacritics);
        const hasUnisex = /(unisex|cho ca nam va nu|cho ca nu va nam|ca hai gioi|phu hop ca hai)/i.test(noDiacritics);

        if (hasUnisex || (hasMale && hasFemale)) {
            genderFilter = 'Unisex';
        } else if (hasMale) {
            genderFilter = 'Male';
        } else if (hasFemale) {
            genderFilter = 'Female';
        }

        // 3. Size Detection (Volume)
        const sizeMatch = processedText.match(/\b(30|50|100|15)0?\s*ml\b/i);
        if (sizeMatch) {
            const sizeStr = sizeMatch[1];
            detectedSize = parseInt(sizeStr);
            if (detectedSize === 15) detectedSize = 150; // Normalize 15ml to 150ml if needed? Based on .NET logic
        }

        // 4. Price Detection
        const priceUnderMatch = noDiacritics.match(/duoi\s+(\d+)\s*trieu/i);
        if (priceUnderMatch) {
            toPrice = parseInt(priceUnderMatch[1]) * 1000000;
        }
        const priceAboveMatch = noDiacritics.match(/tren\s+(\d+)\s*trieu/i);
        if (priceAboveMatch) {
            fromPrice = parseInt(priceAboveMatch[1]) * 1000000;
        }

        // Build the query
        const query = this.searchQueryService.buildSearchQuery(processedText, '75%', 'and', detectedSize);
        const filters = this.searchQueryService.buildFilterQuery({
            gender: genderFilter,
            fromPrice,
            toPrice,
        });

        const body: any = {
            bool: {
                must: [query],
            },
        };

        if (filters.length > 0) {
            body.bool.filter = filters;
        }

        const from = (request.PageNumber - 1) * request.PageSize;

        try {
            const response = await this.elasticsearchService.search({
                index: this.indexName,
                from,
                size: request.PageSize,
                query: body,
                sort: [{ _score: { order: 'desc' } }] as any,
            });

            const total = typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value ?? 0;
            const items = response.hits.hits.map(hit => hit._source);

            return {
                items,
                totalCount: total,
            };
        } catch (error) {
            this.logger.error(`[ES] Search failed:`, error);
            return { items: [], totalCount: 0 };
        }
    }

    /**
     * Search products using AI to extract structured intents
     */
    async searchWithAi(searchText: string, request: PagedAndSortedRequest) {
        if (!searchText) return { items: [], totalCount: 0 };

        // 1. Extract structured search object using AI
        const searchObject = await this.searchAiService.extractSearchObject(searchText);

        // 2. Build ES query from structured object
        this.logger.log(`[ES-AI] Building query for extracted object...`);
        const query = this.searchQueryService.buildQueryFromSearchObject(searchObject);

        const from = (request.PageNumber - 1) * request.PageSize;

        try {
            const response = await this.elasticsearchService.search({
                index: this.indexName,
                from,
                size: request.PageSize,
                query: query,
                sort: [{ _score: { order: 'desc' } }] as any,
            });

            const total = typeof response.hits.total === 'number' ? response.hits.total : (response.hits.total as any)?.value ?? 0;
            const items = response.hits.hits.map(hit => hit._source);

            return {
                items,
                totalCount: total,
                extractedObject: searchObject
            };
        } catch (error) {
            this.logger.error(`[ES-AI] Search failed:`, error);
            return { items: [], totalCount: 0 };
        }
    }

    /**
     * Remove diacritics from string for simplified matching
     */
    private removeDiacritics(str: string): string {
        return str
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D');
    }

    /**
     * Sync all products from database to Elasticsearch
     */
    async syncAllProducts() {
        this.logger.log(`[ES] Syncing all products to Elasticsearch...`);
        const products = await this.prisma.products.findMany({
            where: { IsDeleted: false },
            include: {
                Brands: true,
                Categories: true,
                ProductVariants: {
                    where: { IsDeleted: false },
                    include: {
                        Concentrations: true,
                    },
                },
                ProductAttributes: {
                    include: {
                        Attributes: true,
                        AttributeValues: true,
                    },
                },
                ProductNoteMaps: {
                    include: {
                        ScentNotes: true,
                    },
                },
                ProductFamilyMaps: {
                    include: {
                        OlfactoryFamilies: true,
                    },
                },
            },
        });

        for (const product of products) {
            await this.indexProduct(product);
        }
        this.logger.log(`[ES] Finished syncing ${products.length} products.`);
    }

    /**
     * Index a single product into Elasticsearch
     */
    async indexProduct(p: any) {
        const document = {
            id: p.Id,
            name: p.Name,
            brand: p.Brands?.Name,
            brandId: p.BrandId,
            category: p.Categories?.Name,
            categoryId: p.CategoryId,
            gender: p.Gender,
            genderSearch: p.Gender === 'Male' ? 'Nam' : p.Gender === 'Female' ? 'Nữ' : 'Unisex',
            origin: p.Origin,
            releaseYear: p.ReleaseYear,
            attributes: p.ProductAttributes?.map((a: any) => a.AttributeValues?.Value),
            concentrations: p.ProductVariants?.map((v: any) => v.Concentrations?.Name).filter(Boolean),
            volumes: p.ProductVariants?.map((v: any) => v.VolumeMl),
            skus: p.ProductVariants?.map((v: any) => v.Sku),
            barcodes: p.ProductVariants?.map((v: any) => v.Barcode),
            scentNotes: p.ProductNoteMaps?.map((s: any) => s.ScentNotes?.Name),
            olfactoryFamilies: p.ProductFamilyMaps?.map((f: any) => f.OlfactoryFamilies?.Name),
            variantPrices: p.ProductVariants?.map((v: any) => parseFloat(v.BasePrice)),
            longevity: p.ProductVariants?.map((v: any) => v.Longevity).filter((v: any) => v !== undefined),
            sillage: p.ProductVariants?.map((v: any) => v.Sillage).filter((v: any) => v !== undefined),
            // Embedding logic could be added here if needed
        };

        try {
            await this.elasticsearchService.index({
                index: this.indexName,
                id: p.Id,
                document: document,
            });
        } catch (error) {
            this.logger.error(`[ES] Error indexing product ${p.Id}:`, error);
        }
    }
}
