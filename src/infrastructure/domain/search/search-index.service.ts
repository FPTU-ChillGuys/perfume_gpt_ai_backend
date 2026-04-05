import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SearchIndexService implements OnModuleInit {
    private readonly logger = new Logger(SearchIndexService.name);
    private readonly indexName: string;

    constructor(
        private readonly elasticsearchService: ElasticsearchService,
        private readonly configService: ConfigService,
    ) {
        this.indexName = this.configService.get<string>('ELASTICSEARCH_INDEX_NAME') || 'products';
    }

    async onModuleInit() {
        await this.ensureIndexExists();
    }

    /**
     * Ensures the Elasticsearch "products" index exists with the correct Vietnamese analyzer
     * and perfume-domain synonym filter configured.
     */
    async ensureIndexExists() {
        try {
            const indexExists = await this.elasticsearchService.indices.exists({ index: this.indexName });

            if (indexExists) {
                this.logger.log(`[ES] Index '${this.indexName}' already exists. Skipping creation.`);
                return;
            }

            this.logger.log(`[ES] Index '${this.indexName}' not found. Creating with Vietnamese analyzer + synonym filter...`);

            // Perfume domain synonyms: Tiếng Việt ↔ English
            const synonyms = [
                "ngọt, sweet, vanilla, gourmand, caramel",
                "tươi, tươi mát, fresh, citrus, chanh, cam, bưởi",
                "gỗ, woody, wood, sandalwood, cedar, đàn hương",
                "hoa, floral, flower, rose, hoa hồng, jasmine, nhài",
                "nam tính, masculine, musky, musk, xạ hương",
                "nữ tính, feminine, powdery, phấn",
                "nhẹ nhàng, nhẹ, light, gentle, airy",
                "mạnh, nồng, strong, intense, heavy, bold",
                "biển, aquatic, ocean, marine, nước biển",
                "đất, earthy, moss, patchouli",
                "khói, smoky, smoke, oud, trầm hương",
                "ấm, warm, amber, hổ phách, cozy",
                "spice, spicy, cay, hương cay",
                "mint, bạc hà, menthol",
                "nước hoa, perfume, fragrance, cologne",
                "chanell => chanel",
                "diorr => dior",
                "đi tiệc => party, ban đêm, tiệc tùng",
                "cho nam => masculine, male, men, man",
                "cho nữ => feminine, female, women, woman, phái đẹp"
            ];

            await this.elasticsearchService.indices.create({
                index: this.indexName,
                settings: {
                    analysis: {
                        filter: {
                            perfume_synonym: {
                                type: 'synonym',
                                synonyms: synonyms,
                            },
                        },
                        analyzer: {
                            vi_perfume_analyzer: {
                                type: 'custom',
                                tokenizer: 'vi_tokenizer',
                                filter: ['lowercase', 'perfume_synonym'],
                            },
                        },
                    },
                },
                mappings: {
                    properties: {
                        id: { type: 'keyword' },
                        name: {
                            type: 'text',
                            analyzer: 'vi_perfume_analyzer',
                            fields: {
                                keyword: { type: 'keyword' },
                            },
                        },
                        brand: {
                            type: 'text',
                            analyzer: 'vi_perfume_analyzer',
                            fields: {
                                keyword: { type: 'keyword' },
                            },
                        },
                        brandId: { type: 'keyword' },
                        category: {
                            type: 'text',
                            analyzer: 'vi_perfume_analyzer',
                            fields: {
                                keyword: { type: 'keyword' },
                            },
                        },
                        categoryId: { type: 'keyword' },
                        gender: { type: 'keyword' },
                        genderSearch: {
                            type: 'text',
                            analyzer: 'vi_perfume_analyzer',
                        },
                        origin: {
                            type: 'text',
                            analyzer: 'vi_perfume_analyzer',
                        },
                        releaseYear: { type: 'integer' },
                        description: {
                            type: 'text',
                            analyzer: 'vi_perfume_analyzer',
                        },
                        attributes: {
                            type: 'text',
                            analyzer: 'vi_perfume_analyzer',
                        },
                        concentrations: {
                            type: 'text',
                            analyzer: 'vi_perfume_analyzer',
                        },
                        volumes: { type: 'integer' },
                        skus: { type: 'keyword' },
                        barcodes: { type: 'keyword' },
                        scentNotes: {
                            type: 'text',
                            analyzer: 'vi_perfume_analyzer',
                        },
                        top_notes: { type: 'keyword' },
                        middle_notes: { type: 'keyword' },
                        base_notes: { type: 'keyword' },
                        olfactoryFamilies: {
                            type: 'text',
                            analyzer: 'vi_perfume_analyzer',
                        },
                        longevity: { type: 'integer' },
                        sillage: { type: 'integer' },
                        // Categorized Attributes
                        attr_occasion: { type: 'keyword' },
                        attr_weather_season: { type: 'keyword' },
                        attr_age_group: { type: 'keyword' },
                        attr_style: { type: 'keyword' },
                        attr_scent_character: { type: 'keyword' },
                        attr_time_of_day: { type: 'keyword' },
                        attr_gift_suitability: { type: 'keyword' },
                        attr_skin_type: { type: 'keyword' },
                        embedding: {
                            type: 'dense_vector',
                            dims: 1024,
                            index: true,
                            similarity: 'cosine',
                        },
                    },
                },
            });

            this.logger.log(`[ES] Index '${this.indexName}' created successfully.`);
        } catch (error) {
            this.logger.error(`[ES] Error ensuring index '${this.indexName}':`, error);
        }
    }

    async deleteIndex() {
        try {
            await this.elasticsearchService.indices.delete({ index: this.indexName });
            this.logger.log(`[ES] Index '${this.indexName}' deleted.`);
        } catch (error) {
            this.logger.error(`[ES] Error deleting index '${this.indexName}':`, error);
        }
    }
}
