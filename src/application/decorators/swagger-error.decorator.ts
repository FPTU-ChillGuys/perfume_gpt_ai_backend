import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse
} from '@nestjs/swagger';

const errorShape = (example: Record<string, unknown>): Record<string, unknown> => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: { type: 'string', description: 'Thông báo lỗi' },
    detail: { type: 'object', nullable: true, description: 'Chi tiết lỗi' },
    statusCode: { type: 'number', description: 'HTTP status code' }
  },
  example
});

const E400 = errorShape({
  success: false,
  error: 'Bad Request — Validation failed',
  detail: { message: ['name must be a string', 'price must be a positive number'] },
  statusCode: 400
});

const E401 = errorShape({
  success: false,
  error: 'Unauthorized — Token JWT không hợp lệ hoặc không được cung cấp',
  detail: null,
  statusCode: 401
});

const E403 = errorShape({
  success: false,
  error: 'Forbidden — Yêu cầu role: admin',
  detail: null,
  statusCode: 403
});

const E404 = errorShape({
  success: false,
  error: 'Not Found — Không tìm thấy tài nguyên',
  detail: { id: 'abc-123-def' },
  statusCode: 404
});

const E409 = errorShape({
  success: false,
  error: 'Conflict — Dữ liệu đã tồn tại',
  detail: { duplicateField: 'sku' },
  statusCode: 409
});

const E422 = errorShape({
  success: false,
  error: 'Unprocessable Entity — Dữ liệu không hợp lệ',
  detail: { errors: { name: 'required' } },
  statusCode: 422
});

const E500 = errorShape({
  success: false,
  error: 'Internal Server Error — Lỗi hệ thống',
  detail: { traceId: 'a1b2c3d4' },
  statusCode: 500
});

export const ApiPublicErrorResponses = () =>
  applyDecorators(
    ApiBadRequestResponse({ description: 'Bad Request — Thiếu hoặc sai tham số', schema: E400 }),
    ApiNotFoundResponse({ description: 'Not Found — Không tìm thấy tài nguyên', schema: E404 }),
    ApiInternalServerErrorResponse({ description: 'Internal Server Error — Lỗi hệ thống', schema: E500 })
  );

export const ApiSharedErrorResponses = () =>
  applyDecorators(
    ApiBadRequestResponse({ description: 'Bad Request — Thiếu hoặc sai tham số', schema: E400 }),
    ApiUnauthorizedResponse({ description: 'Unauthorized — Token JWT không hợp lệ hoặc không được cung cấp', schema: E401 }),
    ApiForbiddenResponse({ description: 'Forbidden — Không có quyền truy cập', schema: E403 }),
    ApiNotFoundResponse({ description: 'Not Found — Không tìm thấy tài nguyên', schema: E404 }),
    ApiInternalServerErrorResponse({ description: 'Internal Server Error — Lỗi hệ thống', schema: E500 })
  );

export const ApiSharedAuthErrors = () =>
  applyDecorators(
    ApiUnauthorizedResponse({ description: 'Unauthorized — Token JWT không hợp lệ hoặc không được cung cấp', schema: E401 }),
    ApiForbiddenResponse({ description: 'Forbidden — Không có quyền truy cập', schema: E403 })
  );

export const ApiSharedValidationErrors = () =>
  applyDecorators(
    ApiBadRequestResponse({ description: 'Bad Request — Thiếu hoặc sai tham số', schema: E400 }),
    ApiUnprocessableEntityResponse({ description: 'Unprocessable Entity — Dữ liệu không hợp lệ', schema: E422 })
  );

export const ApiReadErrors = () =>
  applyDecorators(
    ApiNotFoundResponse({ description: 'Not Found — Không tìm thấy tài nguyên', schema: E404 }),
    ApiSharedAuthErrors()
  );

export const ApiWriteErrors = () =>
  applyDecorators(
    ApiBadRequestResponse({ description: 'Bad Request — Thiếu hoặc sai tham số', schema: E400 }),
    ApiNotFoundResponse({ description: 'Not Found — Không tìm thấy tài nguyên', schema: E404 }),
    ApiConflictResponse({ description: 'Conflict — Dữ liệu bị trùng lặp', schema: E409 }),
    ApiSharedAuthErrors()
  );

export const ApiAdminErrors = () =>
  applyDecorators(
    ApiUnauthorizedResponse({ description: 'Unauthorized — Token JWT không hợp lệ hoặc không được cung cấp', schema: E401 }),
    ApiForbiddenResponse({ description: 'Forbidden — Yêu cầu role: admin', schema: E403 }),
    ApiNotFoundResponse({ description: 'Not Found — Không tìm thấy tài nguyên', schema: E404 }),
    ApiInternalServerErrorResponse({ description: 'Internal Server Error — Lỗi hệ thống', schema: E500 })
  );

export const ApiAiErrors = () =>
  applyDecorators(
    ApiBadRequestResponse({ description: 'Bad Request — Thiếu hoặc sai tham số', schema: E400 }),
    ApiInternalServerErrorResponse({ description: 'Internal Server Error — AI service không khả dụng hoặc lỗi xử lý', schema: E500 })
  );