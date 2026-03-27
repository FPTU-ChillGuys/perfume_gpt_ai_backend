import { Injectable } from '@nestjs/common';
import { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types';
import { SearchObjectDto } from 'src/application/dtos/request/search-object.dto';
import { embed } from 'ai';
import { embeddingModel } from 'src/chatbot/ai-model';
export class SearchQueryService {
    /**
     * Builds the main search query with multiple layers (Exact, Semantic, Discovery, Typo, Technical)
     */
    buildSearchQuery(
        searchText: string,
        minimumShouldMatch: string = '75%',
        defaultOp: 'and' | 'or' = 'and',
        detectedSize: number | null = null,
    ): QueryDslQueryContainer {
        const shouldClauses: QueryDslQueryContainer[] = [];

        // Layer 1: Exact Intent (Phrase matching)
        shouldClauses.push({
            multi_match: {
                query: searchText,
                fields: ['name^10', 'brand^8', 'scentNotes^5', 'olfactoryFamilies^5'],
                type: 'phrase',
                boost: 10.0,
            },
        });

        // Layer 2: Semantic & Intent (Most Fields)
        shouldClauses.push({
            multi_match: {
                query: searchText,
                fields: [
                    'name^5',
                    'brand^4',
                    'category^5',
                    'genderSearch^5',
                    'scentNotes^4',
                    'olfactoryFamilies^4',
                    'attributes^3',
                    'concentrations^2',
                    'origin',
                ],
                operator: defaultOp,
                type: 'most_fields',
                minimum_should_match: minimumShouldMatch,
            },
        });

        // Layer 3: Discovery (Scent Notes & Olfactory Families)
        shouldClauses.push({
            multi_match: {
                query: searchText,
                fields: ['scentNotes^6', 'olfactoryFamilies^5'],
                operator: 'or',
                type: 'best_fields',
                boost: 1.5,
            },
        });

        // Layer 4: Typo & Correction (Fuzziness)
        shouldClauses.push({
            multi_match: {
                query: searchText,
                fields: ['name^2', 'brand^2'],
                fuzziness: 'AUTO',
                boost: 0.4,
            },
        });

        // Layer 5: Technical Details (SKU, Barcode)
        shouldClauses.push({
            multi_match: {
                query: searchText,
                fields: ['scentNotes', 'skus^5', 'barcodes^5'],
                operator: 'or',
                type: 'best_fields',
            },
        });

        // Layer 6: Specific Volume Awareness
        if (detectedSize !== null) {
            shouldClauses.push({
                term: {
                    volumes: {
                        value: detectedSize,
                        boost: 25.0,
                    },
                },
            });
        }

        return {
            bool: {
                should: shouldClauses,
            },
        };
    }

    /**
     * Builds filter clauses based on request parameters
     */
    buildFilterQuery(params: {
        gender?: string;
        categoryId?: string;
        brandId?: string;
        fromPrice?: number;
        toPrice?: number;
    }): QueryDslQueryContainer[] {
        const filters: QueryDslQueryContainer[] = [];

        if (params.gender) {
            filters.push({ term: { gender: params.gender } });
        }

        if (params.categoryId) {
            filters.push({ term: { categoryId: params.categoryId } });
        }

        if (params.brandId) {
            filters.push({ term: { brandId: params.brandId } });
        }

        if (params.fromPrice !== undefined || params.toPrice !== undefined) {
            const range: any = {};
            if (params.fromPrice !== undefined) range.gte = params.fromPrice;
            if (params.toPrice !== undefined) range.lte = params.toPrice;
            filters.push({ range: { variantPrices: range } });
        }

        return filters;
    }

    /**
     * Builds a complex Elasticsearch query with kNN for Hybrid Search
     */
    async buildHybridQuery(searchText: string, obj: SearchObjectDto): Promise<{ query: QueryDslQueryContainer, knn?: any }> {
        const mustClauses: QueryDslQueryContainer[] = [];
        const shouldClauses: QueryDslQueryContainer[] = [];
        const filters: QueryDslQueryContainer[] = [];

        // 1. Generate Query Embedding
        let queryEmbedding: number[] | undefined;
        try {
            const { embedding } = await embed({
                model: embeddingModel,
                value: searchText,
                providerOptions: {
                    openai: {
                        dimensions: 1024, // optional, number of dimensions for the embedding
                    }
                },
            });
            queryEmbedding = embedding;
        } catch (error) {
            console.error('[ES] Error generating query embedding:', error);
        }

        // 2. Build filters from SearchObject (Intent)
        if (obj.brand) {
            mustClauses.push({ match: { brand: { query: obj.brand, boost: 2.0 } } });
        }
        if (obj.gender) {
            filters.push({ term: { gender: obj.gender } });
        }
        if (obj.minPrice !== undefined || obj.maxPrice !== undefined) {
            const range: any = {};
            if (obj.minPrice !== undefined) range.gte = obj.minPrice;
            if (obj.maxPrice !== undefined) range.lte = obj.maxPrice;
            filters.push({ range: { variantPrices: range } });
        }
        if (obj.notes && obj.notes.length > 0) {
            obj.notes.forEach(note => {
                shouldClauses.push({ match: { scentNotes: { query: note, boost: 1.5 } } });
            });
        }
        if (obj.topNotes && obj.topNotes.length > 0) {
            obj.topNotes.forEach(note => {
                shouldClauses.push({ match: { top_notes: { query: note, boost: 2.0 } } });
            });
        }
        if (obj.middleNotes && obj.middleNotes.length > 0) {
            obj.middleNotes.forEach(note => {
                shouldClauses.push({ match: { middle_notes: { query: note, boost: 1.8 } } });
            });
        }
        if (obj.baseNotes && obj.baseNotes.length > 0) {
            obj.baseNotes.forEach(note => {
                shouldClauses.push({ match: { base_notes: { query: note, boost: 1.8 } } });
            });
        }
        if (obj.families && obj.families.length > 0) {
            obj.families.forEach(family => {
                shouldClauses.push({ match: { olfactoryFamilies: { query: family, boost: 1.0 } } });
            });
        }

        // Categorized Attribute Filters
        if (obj.occasion) {
            filters.push({ match: { attr_occasion: { query: obj.occasion, boost: 1.2 } } });
        }
        if (obj.weatherSeason) {
            filters.push({ match: { attr_weather_season: { query: obj.weatherSeason, boost: 1.2 } } });
        }
        if (obj.ageGroup) {
            filters.push({ match: { attr_age_group: { query: obj.ageGroup, boost: 1.2 } } });
        }
        if (obj.style) {
            filters.push({ match: { attr_style: { query: obj.style, boost: 1.2 } } });
        }
        if (obj.scentCharacter) {
            filters.push({ match: { attr_scent_character: { query: obj.scentCharacter, boost: 1.2 } } });
        }
        if (obj.timeOfDay) {
            filters.push({ match: { attr_time_of_day: { query: obj.timeOfDay, boost: 1.2 } } });
        }
        if (obj.giftSuitability) {
            filters.push({ match: { attr_gift_suitability: { query: obj.giftSuitability, boost: 1.2 } } });
        }
        if (obj.skinType) {
            filters.push({ match: { attr_skin_type: { query: obj.skinType, boost: 1.2 } } });
        }

        if (obj.minLongevity !== undefined) {
            filters.push({ range: { longevity: { gte: obj.minLongevity } } });
        }
        if (obj.minSillage !== undefined) {
            filters.push({ range: { sillage: { gte: obj.minSillage } } });
        }

        const query: QueryDslQueryContainer = {
            bool: {
                must: mustClauses.length > 0 ? mustClauses : undefined,
                should: shouldClauses.length > 0 ? shouldClauses : undefined,
                filter: filters.length > 0 ? filters : undefined,
                minimum_should_match: (shouldClauses.length > 0 && mustClauses.length === 0) ? 1 : undefined
            }
        };

        const knn: any | undefined = queryEmbedding ? {
            field: 'embedding',
            query_vector: queryEmbedding,
            k: 50,
            num_candidates: 100,
            filter: filters.length > 0 ? filters : undefined,
            boost: 1.0
        } : undefined;

        return { query, knn };
    }

    /**
     * Builds a complex Elasticsearch query from a structured SearchObject extracted by AI
     */
    buildQueryFromSearchObject(obj: SearchObjectDto): QueryDslQueryContainer {
        const mustClauses: QueryDslQueryContainer[] = [];
        const shouldClauses: QueryDslQueryContainer[] = [];
        const filters: QueryDslQueryContainer[] = [];

        // 1. Brand match (Strong filter/must)
        if (obj.brand) {
            mustClauses.push({
                match: {
                    brand: {
                        query: obj.brand,
                        boost: 5.0
                    }
                }
            });
        }

        // 2. Product Name match
        if (obj.productName) {
            shouldClauses.push({
                match: {
                    name: {
                        query: obj.productName,
                        boost: 10.0
                    }
                }
            });
        }

        // 3. Category match
        if (obj.category) {
            shouldClauses.push({
                match: {
                    category: {
                        query: obj.category,
                        boost: 3.0
                    }
                }
            });
        }

        // 4. Gender filter
        if (obj.gender) {
            filters.push({ term: { gender: obj.gender } });
        }

        // 5. Price range filter
        if (obj.minPrice !== undefined || obj.maxPrice !== undefined) {
            const range: any = {};
            if (obj.minPrice !== undefined) range.gte = obj.minPrice;
            if (obj.maxPrice !== undefined) range.lte = obj.maxPrice;
            filters.push({ range: { variantPrices: range } });
        }

        // 6. Scent Notes (Should)
        if (obj.notes && obj.notes.length > 0) {
            obj.notes.forEach(note => {
                shouldClauses.push({
                    match: {
                        scentNotes: {
                            query: note,
                            boost: 2.0
                        }
                    }
                });
            });
        }

        // 7. Olfactory Families (Should)
        if (obj.families && obj.families.length > 0) {
            obj.families.forEach(family => {
                shouldClauses.push({
                    match: {
                        olfactoryFamilies: {
                            query: family,
                            boost: 1.5
                        }
                    }
                });
            });
        }

        // 8. Volume awareness
        if (obj.volume) {
            shouldClauses.push({
                term: {
                    volumes: {
                        value: obj.volume,
                        boost: 5.0
                    }
                }
            });
        }

        // 9. Concentration, Occasion, Season, Description (Combined should)
        const descriptionParts = [
            obj.concentration,
            obj.occasion,
            obj.season,
            obj.description
        ].filter(Boolean) as string[];

        if (descriptionParts.length > 0) {
            shouldClauses.push({
                multi_match: {
                    query: descriptionParts.join(' '),
                    fields: ['attributes', 'concentrations', 'name', 'brand', 'description'],
                    boost: 1.0
                }
            });
        }

        // Categorized Attribute Filters
        if (obj.occasion) {
            filters.push({ match: { attr_occasion: { query: obj.occasion, boost: 1.2 } } });
        }
        if (obj.weatherSeason) {
            filters.push({ match: { attr_weather_season: { query: obj.weatherSeason, boost: 1.2 } } });
        }
        if (obj.ageGroup) {
            filters.push({ match: { attr_age_group: { query: obj.ageGroup, boost: 1.2 } } });
        }
        if (obj.style) {
            filters.push({ match: { attr_style: { query: obj.style, boost: 1.2 } } });
        }
        if (obj.scentCharacter) {
            filters.push({ match: { attr_scent_character: { query: obj.scentCharacter, boost: 1.2 } } });
        }
        if (obj.timeOfDay) {
            filters.push({ match: { attr_time_of_day: { query: obj.timeOfDay, boost: 1.2 } } });
        }
        if (obj.giftSuitability) {
            filters.push({ match: { attr_gift_suitability: { query: obj.giftSuitability, boost: 1.2 } } });
        }
        if (obj.skinType) {
            filters.push({ match: { attr_skin_type: { query: obj.skinType, boost: 1.2 } } });
        }

        // 10. Performance filters (Longevity & Sillage)
        if (obj.minLongevity !== undefined) {
            filters.push({ range: { longevity: { gte: obj.minLongevity } } });
        }
        if (obj.minSillage !== undefined) {
            filters.push({ range: { sillage: { gte: obj.minSillage } } });
        }

        return {
            bool: {
                must: mustClauses.length > 0 ? mustClauses : undefined,
                should: shouldClauses.length > 0 ? shouldClauses : undefined,
                filter: filters.length > 0 ? filters : undefined,
                minimum_should_match: (shouldClauses.length > 0 && mustClauses.length === 0) ? 1 : undefined
            }
        };
    }
}
