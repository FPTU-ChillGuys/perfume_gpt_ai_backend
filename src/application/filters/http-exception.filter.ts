import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';

interface ExceptionResponseBody {
  success: false;
  error: string;
  detail: Record<string, unknown> | null;
  statusCode: number;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception.getResponse();

    const error = this.extractError(exceptionResponse);
    const detail = this.extractDetail(exceptionResponse);

    const body: ExceptionResponseBody = {
      success: false,
      error,
      detail,
      statusCode: status
    };
    response.status(status).json(body);
  }

  private extractError(exceptionResponse: string | object): string {
    if (typeof exceptionResponse === 'string') return exceptionResponse;
    const obj = exceptionResponse as Record<string, unknown>;
    return (obj.error as string) ?? (obj.message as string) ?? 'Unknown error';
  }

  private extractDetail(
    exceptionResponse: string | object
  ): Record<string, unknown> | null {
    if (typeof exceptionResponse === 'string') return null;
    const obj = exceptionResponse as Record<string, unknown>;
    return (obj.detail as Record<string, unknown>) ?? null;
  }
}
