import { Module, Global } from '@nestjs/common';
import { MasterDataTool } from 'src/chatbot/tools/master-data.tool';
import { ChatProfile } from 'src/application/mapping/chat.mapper';
import { MasterDataService } from './master-data.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DictionaryModule } from './dictionary.module';

@Global()
@Module({
  imports: [PrismaModule, DictionaryModule],
  providers: [ChatProfile, MasterDataTool, MasterDataService],
  exports: [ChatProfile, MasterDataTool, MasterDataService]
})
export class MappingModule {}
