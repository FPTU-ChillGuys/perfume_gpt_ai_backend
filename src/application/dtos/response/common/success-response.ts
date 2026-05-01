import { BaseResponse } from './base-response';

export abstract class HttpCodeSuccessResponse<
  T = unknown
> extends BaseResponse<T> {
  readonly __httpStatusCode: number;

  protected constructor(httpStatusCode: number, data?: T) {
    super();
    this.__httpStatusCode = httpStatusCode;
    this.success = true;
    this.data = data;
  }
}

export class SuccessResponse<T = unknown> extends BaseResponse<T> {
  constructor(data?: T) {
    super();
    this.success = true;
    this.data = data;
  }
}

export class OkResponse<T = unknown> extends HttpCodeSuccessResponse<T> {
  constructor(data?: T) {
    super(200, data);
  }
}

export class CreatedResponse<T = unknown> extends HttpCodeSuccessResponse<T> {
  constructor(data?: T) {
    super(201, data);
  }
}

export class AcceptedResponse<T = unknown> extends HttpCodeSuccessResponse<T> {
  constructor(data?: T) {
    super(202, data);
  }
}

export class NoContentResponse extends HttpCodeSuccessResponse<undefined> {
  constructor() {
    super(204, undefined);
  }
}

export const Ok = <T = unknown>(data?: T): OkResponse<T> => {
  return new OkResponse<T>(data);
};

export const Created = <T = unknown>(data?: T): CreatedResponse<T> => {
  return new CreatedResponse<T>(data);
};

export const Accepted = <T = unknown>(data?: T): AcceptedResponse<T> => {
  return new AcceptedResponse<T>(data);
};

export const NoContent = (): NoContentResponse => {
  return new NoContentResponse();
};
