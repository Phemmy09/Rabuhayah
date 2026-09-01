import { config } from '../config.js';
import { logger } from '../logging/logger.js';
import { AuthenticationError, ZohoApiError } from '../errors/AppError.js';
import { CachedToken, ZohoOAuthTokenResponse } from '../../types/zoho.js';

// In-memory token cache across serverless warm invocations
let cachedToken: CachedToken | null = null;
let pendingRefreshPromise: Promise<string> | null = null;

/**
 * Retrieves a valid Zoho CRM OAuth Access Token.
 * Caches token in memory and automatically refreshes 5 minutes before expiration.
 */
export async function getZohoAccessToken(forceRefresh = false): Promise<string> {
  const now = Date.now();

  // Return cached token if valid and not forcing refresh
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  // If a refresh is already in flight, reuse the promise to prevent duplicate concurrent refresh requests
  if (pendingRefreshPromise) {
    return pendingRefreshPromise;
  }

  pendingRefreshPromise = (async () => {
    try {
      const token = await refreshZohoAccessToken();
      return token;
    } finally {
      pendingRefreshPromise = null;
    }
  })();

  return pendingRefreshPromise;
}

/**
 * Requests a new access token from Zoho OAuth 2.0 endpoint using the refresh token
 */
async function refreshZohoAccessToken(): Promise<string> {
  const accountsUrl = config.zoho.accountsUrl;
  const clientId = config.zoho.clientId;
  const clientSecret = config.zoho.clientSecret;
  const refreshToken = config.zoho.refreshToken;

  if (!clientId || !clientSecret || !refreshToken) {
    const errorMsg = 'Zoho OAuth credentials (client ID, client secret, or refresh token) are missing';
    logger.error(errorMsg);
    throw new AuthenticationError(errorMsg);
  }

  const tokenEndpoint = `${accountsUrl}/oauth/v2/token`;
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const startTime = Date.now();
  logger.info('Refreshing Zoho OAuth access token', { accountsUrl });

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const durationMs = Date.now() - startTime;
    const data = (await response.json()) as ZohoOAuthTokenResponse;

    if (!response.ok || data.error) {
      const errorDetail = data.error_description || data.error || `HTTP ${response.status}`;
      logger.error('Failed to refresh Zoho OAuth token', { durationMs, error: data.error });
      throw new AuthenticationError(`Zoho OAuth token refresh failed: ${errorDetail}`, data);
    }

    if (!data.access_token) {
      logger.error('Zoho OAuth response missing access_token', { durationMs });
      throw new ZohoApiError('Invalid Zoho OAuth response structure: missing access_token');
    }

    // Cache the token. Token lasts expires_in seconds (usually 3600s = 1 hour).
    // Buffer with 5 minutes (300s) to avoid edge-of-expiry failures.
    const expiresInSeconds = data.expires_in || 3600;
    const safetyBufferMs = 300 * 1000;
    const expiresAt = Date.now() + expiresInSeconds * 1000 - safetyBufferMs;

    cachedToken = {
      token: data.access_token,
      expiresAt,
    };

    logger.info('Successfully refreshed Zoho access token', {
      durationMs,
      expiresInSeconds,
      apiDomain: data.api_domain,
    });

    return cachedToken.token;
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ZohoApiError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Unknown network error';
    logger.error('Network failure during Zoho OAuth token refresh', undefined, error);
    throw new ZohoApiError(`Failed to connect to Zoho OAuth server: ${message}`);
  }
}

/**
 * Invalidate cached token manually (useful when API returns 401 Invalid Token)
 */
export function clearCachedZohoToken(): void {
  cachedToken = null;
}

/**
 * Returns current token cache status (for diagnostic endpoints only, never exposes token)
 */
export function getTokenCacheStatus(): { isCached: boolean; expiresInSeconds?: number } {
  if (!cachedToken) {
    return { isCached: false };
  }
  const remainingMs = cachedToken.expiresAt - Date.now();
  return {
    isCached: remainingMs > 0,
    expiresInSeconds: remainingMs > 0 ? Math.floor(remainingMs / 1000) : 0,
  };
}
