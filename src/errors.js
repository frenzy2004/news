export class MissingConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "MissingConfigError";
  }
}

export class BtwApiError extends Error {
  constructor(message, { endpoint, status, body } = {}) {
    super(message);
    this.name = "BtwApiError";
    this.endpoint = endpoint;
    this.status = status;
    this.body = body;
  }
}

export class ExaApiError extends Error {
  constructor(message, { endpoint, status, body } = {}) {
    super(message);
    this.name = "ExaApiError";
    this.endpoint = endpoint;
    this.status = status;
    this.body = body;
  }
}
