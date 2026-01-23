import { BaseResponse } from 'src/application/dtos/response/common/base-response';

export async function funcHandler<T>(
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
