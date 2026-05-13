export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 400, code = "app_error") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class HttpError extends AppError {
  constructor(statusCode: number, message: string, code = "http_error") {
    super(message, statusCode, code);
    this.name = "HttpError";
  }
}
