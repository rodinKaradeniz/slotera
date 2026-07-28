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
