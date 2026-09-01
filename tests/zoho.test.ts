import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getZohoAccessToken, clearCachedZohoToken } from '../lib/zoho/auth.js';
import { findCustomerByPhone } from '../lib/zoho/customer.js';
import { config } from '../lib/config.js';

describe('Zoho CRM Service & Customer Matching Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearCachedZohoToken();
    // Ensure test config has valid credentials
    config.zoho.clientId = 'test_client_id';
    config.zoho.clientSecret = 'test_client_secret';
    config.zoho.refreshToken = 'test_refresh_token';
  });

  describe('OAuth 2.0 Token Refresh & Caching', () => {
    it('fetches fresh token from Zoho OAuth endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mock_access_token_123',
          api_domain: 'https://www.zohoapis.com',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const token = await getZohoAccessToken();
      expect(token).toBe('mock_access_token_123');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should return cached token without calling fetch again
      const cachedToken = await getZohoAccessToken();
      expect(cachedToken).toBe('mock_access_token_123');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Customer Resolution (findCustomerByPhone)', () => {
    it('finds Contact and prioritizes over Leads', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/oauth/v2/token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'token_1', expires_in: 3600 }),
          };
        }
        if (url.includes('/Contacts/search')) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                data: [
                  {
                    id: 'contact_555',
                    First_Name: 'Bolu',
                    Last_Name: 'Adeyemi',
                    Full_Name: 'Bolu Adeyemi',
                    Phone: '+2348012345678',
                    Email: 'bolu@example.com',
                    Account_Name: { id: 'acc_1', name: 'Tech Solutions Ltd' },
                  },
                ],
              }),
          };
        }
        return {
          ok: true,
          status: 204,
          text: async () => '',
        };
      });

      vi.stubGlobal('fetch', mockFetch);

      const customer = await findCustomerByPhone('+2348012345678');

      expect(customer.found).toBe(true);
      expect(customer.module).toBe('Contacts');
      expect(customer.id).toBe('contact_555');
      expect(customer.firstName).toBe('Bolu');
      expect(customer.lastName).toBe('Adeyemi');
      expect(customer.company).toBe('Tech Solutions Ltd');
      expect(customer.customerType).toBe('Existing Customer');
    });

    it('finds Lead when no Contact matches', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/oauth/v2/token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'token_1', expires_in: 3600 }),
          };
        }
        if (url.includes('/Contacts/search')) {
          return {
            ok: true,
            status: 204,
            text: async () => '',
          };
        }
        if (url.includes('/Leads/search')) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                data: [
                  {
                    id: 'lead_777',
                    First_Name: 'Femi',
                    Last_Name: 'Bakare',
                    Full_Name: 'Femi Bakare',
                    Phone: '+2348012345678',
                    Email: 'femi@example.com',
                    Company: 'Bakare Logistics',
                    Lead_Status: 'Contacted',
                  },
                ],
              }),
          };
        }
        return {
          ok: true,
          status: 204,
          text: async () => '',
        };
      });

      vi.stubGlobal('fetch', mockFetch);

      const customer = await findCustomerByPhone('+2348012345678');

      expect(customer.found).toBe(true);
      expect(customer.module).toBe('Leads');
      expect(customer.id).toBe('lead_777');
      expect(customer.fullName).toBe('Femi Bakare');
      expect(customer.company).toBe('Bakare Logistics');
      expect(customer.leadStatus).toBe('Contacted');
      expect(customer.customerType).toBe('Lead');
    });

    it('returns found=false cleanly when neither Contact nor Lead exists', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/oauth/v2/token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'token_1', expires_in: 3600 }),
          };
        }
        return {
          ok: true,
          status: 204,
          text: async () => '',
        };
      });

      vi.stubGlobal('fetch', mockFetch);

      const customer = await findCustomerByPhone('+2348099999999');

      expect(customer.found).toBe(false);
      expect(customer.id).toBeNull();
      expect(customer.customerType).toBe('New Caller');
    });
  });
});
