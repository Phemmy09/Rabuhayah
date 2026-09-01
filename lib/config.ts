import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

export interface AppConfig {
  env: 'development' | 'staging' | 'production' | 'test';
  retell: {
    apiKey: string;
    webhookSecret?: string;
  };
  zoho: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    accountsUrl: string;
    apiDomain: string;
  };
  business: {
    defaultPhoneCountry: string;
    createLeadsForUnknownCallers: boolean;
    searchContactsFirst: boolean;
    searchLeadsSecond: boolean;
    updateRecordsAfterCall: boolean;
    leadSource: string;
    diagnosticApiKey?: string;
  };
}

export const config: AppConfig = {
  env: (process.env.APP_ENV as AppConfig['env']) || (process.env.NODE_ENV as AppConfig['env']) || 'development',
  retell: {
    apiKey: process.env.RETELL_API_KEY || '',
    webhookSecret: process.env.RETELL_WEBHOOK_SECRET || process.env.RETELL_API_KEY || '',
  },
  zoho: {
    clientId: process.env.ZOHO_CLIENT_ID || '',
    clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
    refreshToken: process.env.ZOHO_REFRESH_TOKEN || '',
    accountsUrl: (process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com').replace(/\/+$/, ''),
    apiDomain: (process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com').replace(/\/+$/, ''),
  },
  business: {
    defaultPhoneCountry: process.env.DEFAULT_PHONE_COUNTRY || 'NG',
    createLeadsForUnknownCallers: process.env.CREATE_LEADS_FOR_UNKNOWN_CALLERS !== 'false',
    searchContactsFirst: true,
    searchLeadsSecond: true,
    updateRecordsAfterCall: true,
    leadSource: process.env.LEAD_SOURCE || 'AI Voice Agent',
    diagnosticApiKey: process.env.DIAGNOSTIC_API_KEY,
  },
};

/**
 * Validates that critical environment variables exist at runtime
 */
export function validateEnvironment(): { isValid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!config.retell.apiKey && config.env !== 'test') {
    missing.push('RETELL_API_KEY');
  }
  if (!config.zoho.clientId && config.env !== 'test') {
    missing.push('ZOHO_CLIENT_ID');
  }
  if (!config.zoho.clientSecret && config.env !== 'test') {
    missing.push('ZOHO_CLIENT_SECRET');
  }
  if (!config.zoho.refreshToken && config.env !== 'test') {
    missing.push('ZOHO_REFRESH_TOKEN');
  }

  return {
    isValid: missing.length === 0,
    missing,
  };
}
