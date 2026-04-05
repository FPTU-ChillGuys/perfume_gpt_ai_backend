import { forwardRef, Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SearchIndexService } from 'src/infrastructure/domain/search/search-index.service';
import { SearchQueryService } from 'src/infrastructure/domain/search/search-query.service';
import { SearchService } from 'src/infrastructure/domain/search/search.service';
import { AdminInstructionModule } from 'src/infrastructure/domain/admin-instruction/admin-instruction.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AIModule } from 'src/infrastructure/domain/ai/ai.module';

import { MasterDataService } from 'src/infrastructure/domain/common/master-data.service';

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
