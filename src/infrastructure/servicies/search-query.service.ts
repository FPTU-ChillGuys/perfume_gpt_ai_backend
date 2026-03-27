import { Injectable } from '@nestjs/common';
import { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types';

@Injectable()
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
                fields: ['volumes', 'skus^5', 'barcodes^5'],
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
}
