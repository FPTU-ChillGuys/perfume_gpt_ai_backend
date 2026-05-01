import { Global, Module } from '@nestjs/common';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';
import { PromptLoaderService } from 'src/infrastructure/domain/utils/prompt-loader.service';

@Global()
@Module({
  providers: [I18nErrorHandler, PromptLoaderService],
  exports: [I18nErrorHandler, PromptLoaderService]
})
export class I18nErrorHandlerModule {}
