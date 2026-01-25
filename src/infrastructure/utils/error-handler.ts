import { BaseResponse } from 'src/application/dtos/response/common/base-response';

export async function funcHandlerAsync<T>(
  fn: () => Promise<BaseResponse<T>>,
  errorMessage: string,
  showErrors = false
): Promise<BaseResponse<T>> {
  try {
    return await fn();
  } catch (errors) {
    if (showErrors) console.error(errors);
    return {
      success: false,
      error: errorMessage
    };
  }
}

export function funcHandler<T>(
  fn: () => BaseResponse<T>,
  errorMessage: string,
  showErrors = false
): BaseResponse<T> {
  try {
    return fn();
  } catch (errors) {
    if (showErrors) console.error(errors);
    return {
      success: false,
      error: errorMessage
    };
  }
}
