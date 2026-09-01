import { LogContext } from '../../types/common.js';

const SENSITIVE_KEYS = [
  'client_secret',
  'clientSecret',
  'refresh_token',
  'refreshToken',
  'access_token',
  'accessToken',
  'api_key',
  'apiKey',
  'authorization',
  'secret',
  'password',
  'cvv',
  'otp',
];

/**
 * Mask a phone number for privacy in logs
 * e.g., "+2348012345678" -> "+234801****678"
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return 'N/A';
  const clean = phone.trim();
  if (clean.length < 7) return '***';
  const start = clean.slice(0, Math.min(6, Math.floor(clean.length / 2)));
  const end = clean.slice(-3);
  return `${start}****${end}`;
}

/**
 * Recursively sanitize an object by redacting sensitive values
 */
export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey === 'from_number' || lowerKey === 'to_number') {
        sanitized[key] = typeof value === 'string' ? maskPhone(value) : sanitizeLogData(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeLogData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return data;
}

export class Logger {
  private formatMessage(level: string, message: string, context?: LogContext, details?: unknown) {
    const timestamp = new Date().toISOString();
    const sanitizedContext = context ? (sanitizeLogData(context) as Record<string, unknown>) : {};
    const sanitizedDetails = details ? sanitizeLogData(details) : undefined;

    return JSON.stringify({
      timestamp,
      level,
      message,
      context: sanitizedContext,
      ...(sanitizedDetails ? { details: sanitizedDetails } : {}),
    });
  }

  public info(message: string, context?: LogContext, details?: unknown): void {
    console.log(this.formatMessage('INFO', message, context, details));
  }

  public warn(message: string, context?: LogContext, details?: unknown): void {
    console.warn(this.formatMessage('WARN', message, context, details));
  }

  public error(message: string, context?: LogContext, error?: unknown): void {
    let errorDetails: unknown = error;
    if (error instanceof Error) {
      errorDetails = {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
      };
    }
    console.error(this.formatMessage('ERROR', message, context, errorDetails));
  }

  public debug(message: string, context?: LogContext, details?: unknown): void {
    if (process.env.APP_ENV === 'development' || process.env.DEBUG === 'true') {
      console.debug(this.formatMessage('DEBUG', message, context, details));
    }
  }
}

export const logger = new Logger();
