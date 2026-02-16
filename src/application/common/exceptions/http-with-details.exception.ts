import { HttpException, HttpStatus } from '@nestjs/common';

export type ExceptionDetail = Record<string, unknown>;

export class HttpExceptionWithDetails extends HttpException {
  constructor(status: HttpStatus, error: string, detail?: ExceptionDetail) {
    super({ error, detail }, status);
  }
}

export class BadRequestWithDetailsException extends HttpExceptionWithDetails {
  constructor(error = 'Bad Request', detail?: ExceptionDetail) {
    super(HttpStatus.BAD_REQUEST, error, detail);
  }
}

export class UnauthorizedWithDetailsException extends HttpExceptionWithDetails {
  constructor(error = 'Unauthorized', detail?: ExceptionDetail) {
    super(HttpStatus.UNAUTHORIZED, error, detail);
  }
}

export class ForbiddenWithDetailsException extends HttpExceptionWithDetails {
  constructor(error = 'Forbidden', detail?: ExceptionDetail) {
    super(HttpStatus.FORBIDDEN, error, detail);
  }
}

export class NotFoundWithDetailsException extends HttpExceptionWithDetails {
  constructor(error = 'Not Found', detail?: ExceptionDetail) {
    super(HttpStatus.NOT_FOUND, error, detail);
  }
}

export class ConflictWithDetailsException extends HttpExceptionWithDetails {
  constructor(error = 'Conflict', detail?: ExceptionDetail) {
    super(HttpStatus.CONFLICT, error, detail);
  }
}

export class InternalServerErrorWithDetailsException extends HttpExceptionWithDetails {
  constructor(error = 'Internal Server Error', detail?: ExceptionDetail) {
    super(HttpStatus.INTERNAL_SERVER_ERROR, error, detail);
  }
}
