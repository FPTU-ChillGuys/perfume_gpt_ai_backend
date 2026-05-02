import { Module } from '@nestjs/common';
import { ProfileService } from 'src/infrastructure/domain/profile/profile.service';
import { ProfileTool } from 'src/chatbot/tools/profile.tool';
@Module({
  imports: [],
  controllers: [],
  providers: [ProfileService, ProfileTool],
  exports: [ProfileService, ProfileTool]
})
export class ProfileModule {}
