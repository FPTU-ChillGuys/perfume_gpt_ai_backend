import { Module } from '@nestjs/common';
import { ChatProfile } from 'src/application/mapping/chat.mapper';

@Module({
  providers: [ChatProfile],
  exports: [ChatProfile]
})
export class MappingModule {}
