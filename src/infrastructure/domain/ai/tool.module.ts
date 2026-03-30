import { Module } from '@nestjs/common';
import { Tools } from 'src/chatbot/utils/tools';

@Module({
  providers: [Tools],
  exports: [Tools]
})
export class ToolModule { }
