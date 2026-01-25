export class BaseResponse<T = undefined> {
  success!: boolean;
  error?: string | null;
  payload?: T;
}
