import { config } from '../config.js';
import { logger } from '../logging/logger.js';
import { getZohoAccessToken, clearCachedZohoToken } from './auth.js';
import { ZohoApiError } from '../errors/AppError.js';

const DEFAULT_TIMEOUT_MS = 6500;

interface ZohoRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  timeoutMs?: number;
  retryOnAuthFailure?: boolean;
}

/**
 * Low-level Zoho CRM HTTP Client
 */
export async function zohoRequest<T = unknown>(
  path: string,
  options: ZohoRequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    params,
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryOnAuthFailure = true,
  } = options;

  const accessToken = await getZohoAccessToken();
  const apiDomain = config.zoho.apiDomain;

  // Build URL with query params
  const url = new URL(`${apiDomain}/crm/v6${path.startsWith('/') ? path : `/${path}`}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const startTime = Date.now();
  const requestPath = url.pathname + url.search;

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;

    // Handle 204 No Content (Common in Zoho CRM when no records match search)
    if (response.status === 204) {
      return { data: [] } as unknown as T;
    }

    const responseText = await response.text();
    let json: any = {};
    if (responseText) {
      try {
        json = JSON.parse(responseText);
      } catch {
        json = { raw: responseText };
      }
    }

    // If 401 Unauthorized, token might be invalid; retry once with a fresh token
    if (response.status === 401 && retryOnAuthFailure) {
      logger.warn('Zoho returned 401 Unauthorized, invalidating token and retrying', {
        path: requestPath,
        durationMs,
      });
      clearCachedZohoToken();
      return zohoRequest<T>(path, { ...options, retryOnAuthFailure: false });
    }

    // Zoho standard error responses (4xx, 5xx, or 200 with code "NO_DATA")
    if (json && (json.code === 'NO_DATA' || json.status === 'error' && json.code === 'INVALID_DATA')) {
      return { data: [] } as unknown as T;
    }

    if (!response.ok) {
      const errorMsg = json.message || json.code || `Zoho API error HTTP ${response.status}`;
      logger.error('Zoho CRM API request failed', {
        status: response.status,
        path: requestPath,
        durationMs,
        code: json.code,
      });
      throw new ZohoApiError(errorMsg, response.status, json);
    }

    return json as T;
  } catch (error) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;

    if (error instanceof ZohoApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('Zoho CRM API request timed out', { path: requestPath, timeoutMs, durationMs });
      throw new ZohoApiError(`Zoho CRM API timed out after ${timeoutMs}ms`, 504);
    }

    const message = error instanceof Error ? error.message : 'Unknown network error';
    logger.error('Zoho CRM API network error', { path: requestPath, durationMs }, error);
    throw new ZohoApiError(`Zoho CRM network failure: ${message}`, 502);
  }
}

export const zohoClient = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>, timeoutMs?: number) =>
    zohoRequest<T>(path, { method: 'GET', params, timeoutMs }),

  post: <T>(path: string, body: unknown, timeoutMs?: number) =>
    zohoRequest<T>(path, { method: 'POST', body, timeoutMs }),

  put: <T>(path: string, body: unknown, timeoutMs?: number) =>
    zohoRequest<T>(path, { method: 'PUT', body, timeoutMs }),
};
