export class BaseResponseAPI<T = undefined> {
  success!: boolean;
  error?: string | null;
  payload?: T;
}
