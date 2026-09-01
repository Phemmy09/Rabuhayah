import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getZohoAccessToken, getTokenCacheStatus } from '../../lib/zoho/auth.js';
import { findCustomerByPhone } from '../../lib/zoho/customer.js';
import { config } from '../../lib/config.js';
import { logger } from '../../lib/logging/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security check: Protect diagnostic endpoint in production
  if (config.env === 'production') {
    const diagnosticKey = req.headers['x-diagnostic-key'] || req.query.key;
    if (!config.business.diagnosticApiKey || diagnosticKey !== config.business.diagnosticApiKey) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Diagnostic endpoint is disabled in production' },
      });
    }
  }

  const phoneQuery = (req.query.phone as string) || '';
  const startTime = Date.now();

  try {
    // 1. Test OAuth token generation
    const token = await getZohoAccessToken();
    const tokenStatus = getTokenCacheStatus();

    // 2. Test Customer lookup if phone was provided
    let customerResult = null;
    if (phoneQuery) {
      customerResult = await findCustomerByPhone(phoneQuery);
    }

    const durationMs = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      service: 'zoho-connectivity-test',
      environment: config.env,
      durationMs,
      oauthStatus: {
        connected: Boolean(token),
        isCached: tokenStatus.isCached,
        expiresInSeconds: tokenStatus.expiresInSeconds,
        accountsUrl: config.zoho.accountsUrl,
        apiDomain: config.zoho.apiDomain,
      },
      searchTest: phoneQuery
        ? {
            queriedPhone: phoneQuery,
            result: customerResult,
          }
        : 'Pass ?phone=+234... or ?phone=+971... to test live customer search',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Zoho test endpoint failed', { durationMs }, error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Zoho error',
      durationMs,
      timestamp: new Date().toISOString(),
    });
  }
}
