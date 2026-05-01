import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import {
  BadRequestWithDetailsException,
  ConflictWithDetailsException,
  ForbiddenWithDetailsException,
  InternalServerErrorWithDetailsException,
  NotFoundWithDetailsException,
  UnauthorizedWithDetailsException
} from 'src/application/common/exceptions/http-with-details.exception';

type ExceptionClass =
  | typeof BadRequestWithDetailsException
  | typeof UnauthorizedWithDetailsException
  | typeof ForbiddenWithDetailsException
  | typeof NotFoundWithDetailsException
  | typeof ConflictWithDetailsException
  | typeof InternalServerErrorWithDetailsException;

@Injectable()
export class I18nErrorHandler {
  private readonly logger = new Logger(I18nErrorHandler.name);

  constructor(private readonly i18n: I18nService) {}

  t(key: string, args?: Record<string, unknown>): string {
    return this.i18n.t(key, { lang: 'vi', args });
  }

  fail<T>(key: string, args?: Record<string, unknown>): BaseResponse<T> {
    return { success: false, error: this.t(key, args) };
  }

  async wrap<T>(
    fn: () => Promise<BaseResponse<T>>,
    key: string,
    args?: Record<string, unknown>
  ): Promise<BaseResponse<T>> {
    try {
      return await fn();
    } catch (error) {
      this.logger.error(this.t(key, args), error);
      return { success: false, error: this.t(key, args) };
    }
  }

  throw(key: string, exceptionClass: ExceptionClass, args?: Record<string, unknown>): never {
    throw new exceptionClass(this.t(key, args));
  }

  log(key: string, args?: Record<string, unknown>): void {
    this.logger.error(this.t(key, args));
  }

  logWithDetail(key: string, detail: string, args?: Record<string, unknown>): void {
    this.logger.error(`${this.t(key, args)}: ${detail}`);
  }
}