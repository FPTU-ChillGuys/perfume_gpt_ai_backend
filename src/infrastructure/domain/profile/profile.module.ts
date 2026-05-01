import { Module } from "@nestjs/common";
import { ProfileService } from 'src/infrastructure/domain/profile/profile.service';
import { ProfileTool } from "src/chatbot/tools/profile.tool";
import { ProviderModule } from 'src/infrastructure/domain/common/provider.module';

@Module({
  imports: [ProviderModule],
  controllers: [],
  providers: [ProfileService, ProfileTool],
  exports: [ProfileService, ProfileTool]
})
export class ProfileModule { }
