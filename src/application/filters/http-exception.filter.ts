import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception.getResponse();

    // Nếu exceptionResponse là object thì lấy info, nếu là string thì dùng fallback
    const error =
      typeof exceptionResponse === 'object'
        ? (exceptionResponse as any).error ?? (exceptionResponse as any).message
        : exceptionResponse;

    const detail =
      typeof exceptionResponse === 'object'
        ? (exceptionResponse as any).detail
        : null;

    response.status(status).json({
      success: false,
      data: null,
      error,
      detail,
      statusCode: status,
    });
  }
}