import { Global, Module } from '@nestjs/common';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';

@Global()
@Module({
  providers: [I18nErrorHandler],
  exports: [I18nErrorHandler]
})
export class I18nErrorHandlerModule {}