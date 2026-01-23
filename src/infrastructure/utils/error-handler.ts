import { BaseResponse } from 'src/application/dtos/response/common/base-response';

export async function funcHandlerAsync<T>(
  fn: () => Promise<BaseResponse<T>>,
  errorMessage: string
): Promise<BaseResponse<T>> {
  try {
    return await fn();
  } catch {
    return {
      success: false,
      error: errorMessage
    };
  }
}

export function funcHandler<T>(
  fn: () => BaseResponse<T>,
  errorMessage: string
): BaseResponse<T> {
  try {
    return fn();
  } catch {
    return {
      success: false,
      error: errorMessage
    };
  }
}
