import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SearchIndexService } from '../servicies/search-index.service';
import { SearchQueryService } from '../servicies/search-query.service';
import { SearchService } from '../servicies/search.service';
import { SearchAiService } from '../servicies/search-ai.service';
import { AdminInstructionModule } from './admin-instruction.module';
import { PrismaModule } from '../../prisma/prisma.module';

import { MasterDataService } from '../servicies/master-data.service';
import { ConversationAnalysisService } from '../servicies/conversation-analysis.service';

@Module({
    imports: [
        AdminInstructionModule,
        PrismaModule,
        ElasticsearchModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                node: configService.get<string>('ELASTICSEARCH_NODE') || 'http://localhost:9200',
                maxRetries: 5,
                requestTimeout: 60000,
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [SearchService, SearchQueryService, SearchIndexService, SearchAiService, MasterDataService, ConversationAnalysisService],
    exports: [ElasticsearchModule, SearchService, SearchQueryService, SearchIndexService, SearchAiService, MasterDataService, ConversationAnalysisService],
})
export class SearchModule { }
