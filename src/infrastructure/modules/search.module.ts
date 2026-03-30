import { forwardRef, Global, Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SearchIndexService } from '../servicies/search-index.service';
import { SearchQueryService } from '../servicies/search-query.service';
import { SearchService } from '../servicies/search.service';
import { AdminInstructionModule } from './admin-instruction.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AIModule } from './ai.module';

import { MasterDataService } from '../servicies/master-data.service';

@Global()
@Module({
    imports: [
        forwardRef(() => AIModule),
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
    providers: [SearchService, SearchQueryService, SearchIndexService, MasterDataService],
    exports: [ElasticsearchModule, SearchService, SearchQueryService, SearchIndexService, MasterDataService],
})
export class SearchModule { }
