import type { VercelRequest, VercelResponse } from '@vercel/node';
import { config, validateEnvironment } from '../lib/config.js';
import { getTokenCacheStatus } from '../lib/zoho/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
      timestamp: new Date().toISOString(),
    });
  }

  const envValidation = validateEnvironment();
  const tokenStatus = getTokenCacheStatus();

  return res.status(200).json({
    status: 'ok',
    service: 'retell-zoho-integration',
    environment: config.env,
    timestamp: new Date().toISOString(),
    configuration: {
      hasRetellKey: Boolean(config.retell.apiKey),
      hasZohoClientId: Boolean(config.zoho.clientId),
      hasZohoClientSecret: Boolean(config.zoho.clientSecret),
      hasZohoRefreshToken: Boolean(config.zoho.refreshToken),
      zohoAccountsUrl: config.zoho.accountsUrl,
      zohoApiDomain: config.zoho.apiDomain,
      defaultPhoneCountry: config.business.defaultPhoneCountry,
      isEnvironmentValid: envValidation.isValid,
    },
    zohoTokenCache: {
      isCached: tokenStatus.isCached,
      expiresInSeconds: tokenStatus.expiresInSeconds,
    },
  });
}
