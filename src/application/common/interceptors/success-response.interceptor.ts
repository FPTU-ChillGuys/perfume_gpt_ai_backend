import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import {
  HttpCodeSuccessResponse,
  NoContentResponse,
  Ok
} from 'src/application/dtos/response/common/success-response';

type WrappedResponse = {
  success?: unknown;
};

@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse<{
      statusCode?: number;
      status?: (code: number) => unknown;
    }>();

    return next.handle().pipe(
      map((data: unknown) => {
        const statusCode = response?.statusCode ?? 200;

        if (statusCode < 200 || statusCode >= 300) {
          return data;
        }

        if (data instanceof HttpCodeSuccessResponse) {
          response?.status?.(data.__httpStatusCode);

          if (data instanceof NoContentResponse) {
            return undefined;
          }

          return data;
        }

        if (data instanceof NoContentResponse) {
          response?.status?.(204);
          return undefined;
        }

        if (statusCode === 204) {
          return data;
        }

        if (data instanceof StreamableFile || Buffer.isBuffer(data)) {
          return data;
        }

        if (this.isAlreadyWrapped(data)) {
          return data;
        }

        return Ok(data);
      })
    );
  }

  private isAlreadyWrapped(data: unknown): data is WrappedResponse {
    return typeof data === 'object' && data !== null && 'success' in data;
  }
}
