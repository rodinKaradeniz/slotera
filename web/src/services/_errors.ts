export class NotImplementedError extends Error {
  constructor(name: string) {
    super(`${name} is not implemented for the api data source yet.`);
    this.name = "NotImplementedError";
  }
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
    this.name = "NotFoundError";
  }
}

export type ApiErrorDetail = {
  location: (string | number)[];
  message: string;
  type: string;
};

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}
