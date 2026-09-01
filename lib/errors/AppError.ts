/**
 * Application Error hierarchy
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ZohoApiError extends AppError {
  constructor(message: string, statusCode = 502, details?: unknown) {
    super(message, statusCode, 'ZOHO_API_ERROR', details);
  }
}

export class RetellVerificationError extends AppError {
  constructor(message = 'Invalid Retell webhook signature') {
    super(message, 401, 'RETELL_SIGNATURE_INVALID');
  }
}
