import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyRetellWebhook } from '../lib/retell/verification.js';
import { computeHmacSha256 } from '../lib/security/signatures.js';
import inboundHandler from '../api/retell/inbound.js';
import webhookHandler from '../api/retell/webhook.js';
import * as customerResolver from '../lib/zoho/customer.js';
import * as contactModule from '../lib/zoho/contacts.js';
import * as leadModule from '../lib/zoho/leads.js';

describe('Retell AI Webhook & Verification Tests', () => {
  const testApiKey = 'key_test_secret_12345';
  const testPayload = JSON.stringify({
    event: 'call_inbound',
    call_inbound: {
      from_number: '+2348012345678',
      to_number: '+2348098765432',
      agent_id: 'agent_test_01',
    },
  });

  describe('Signature Verification', () => {
    it('verifies valid HMAC-SHA256 signature', () => {
      const validSig = computeHmacSha256(testPayload, testApiKey);
      const result = verifyRetellWebhook(testPayload, validSig, testApiKey);
      expect(result).toBe(true);
    });

    it('rejects tampered payload', () => {
      const validSig = computeHmacSha256(testPayload, testApiKey);
      const tamperedPayload = testPayload.replace('+2348012345678', '+14155550000');
      const result = verifyRetellWebhook(tamperedPayload, validSig, testApiKey);
      expect(result).toBe(false);
    });

    it('rejects incorrect signature', () => {
      const result = verifyRetellWebhook(testPayload, 'invalid_signature_string', testApiKey);
      expect(result).toBe(false);
    });
  });

  describe('Inbound Endpoint Handler', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('processes inbound call and returns dynamic variables for known contact', async () => {
      vi.spyOn(customerResolver, 'findCustomerByPhone').mockResolvedValueOnce({
        found: true,
        module: 'Contacts',
        id: 'contact_999',
        firstName: 'Emeka',
        lastName: 'Okafor',
        fullName: 'Emeka Okafor',
        phone: '+2348012345678',
        email: 'emeka@example.com',
        company: 'Prime Energy Ltd',
        leadStatus: null,
        customerType: 'Existing Customer',
        notes: 'Requested VIP support plan',
      });

      const req: any = {
        method: 'POST',
        headers: {},
        body: {
          event: 'call_inbound',
          call_inbound: {
            from_number: '08012345678',
            to_number: '+2348098765432',
            agent_id: 'agent_support_001',
          },
        },
      };

      let responseData: any = null;
      let statusCode = 0;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseData = data;
              return res;
            },
          };
        },
      };

      await inboundHandler(req, res);

      expect(statusCode).toBe(200);
      expect(responseData.call_inbound).toBeDefined();
      expect(responseData.call_inbound.dynamic_variables.customer_found).toBe('true');
      expect(responseData.call_inbound.dynamic_variables.customer_name).toBe('Emeka Okafor');
      expect(responseData.call_inbound.dynamic_variables.first_name).toBe('Emeka');
      expect(responseData.call_inbound.dynamic_variables.company_name).toBe('Prime Energy Ltd');
      expect(responseData.call_inbound.dynamic_variables.customer_phone).toBe('+2348012345678');
    });

    it('returns fallback dynamic variables when caller is unknown', async () => {
      vi.spyOn(customerResolver, 'findCustomerByPhone').mockResolvedValueOnce({
        found: false,
        module: null,
        id: null,
        firstName: '',
        lastName: '',
        fullName: '',
        phone: '+2348099999999',
        email: '',
        company: '',
        leadStatus: null,
        customerType: 'New Caller',
      });

      const req: any = {
        method: 'POST',
        headers: {},
        body: {
          event: 'call_inbound',
          call_inbound: {
            from_number: '+2348099999999',
            to_number: '+2348098765432',
          },
        },
      };

      let responseData: any = null;
      let statusCode = 0;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseData = data;
              return res;
            },
          };
        },
      };

      await inboundHandler(req, res);

      expect(statusCode).toBe(200);
      expect(responseData.call_inbound.dynamic_variables.customer_found).toBe('false');
      expect(responseData.call_inbound.dynamic_variables.customer_name).toBe('');
      expect(responseData.call_inbound.dynamic_variables.customer_type).toBe('New Caller');
    });
  });

  describe('Post-Call Webhook Handler', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('updates existing contact on call_analyzed event', async () => {
      vi.spyOn(customerResolver, 'findCustomerByPhone').mockResolvedValueOnce({
        found: true,
        module: 'Contacts',
        id: 'contact_123',
        firstName: 'Jane',
        lastName: 'Doe',
        fullName: 'Jane Doe',
        phone: '+2348012345678',
        email: 'jane@example.com',
        company: 'Acme Corp',
        leadStatus: null,
        customerType: 'Existing Customer',
      });

      const updateSpy = vi.spyOn(contactModule, 'updateContact').mockResolvedValueOnce(true);

      const req: any = {
        method: 'POST',
        headers: {},
        body: {
          event: 'call_analyzed',
          call: {
            call_id: 'call_abc_123',
            agent_id: 'agent_sales_002',
            from_number: '+2348012345678',
            duration_ms: 85000,
            recording_url: 'https://recordings.retellai.com/call_abc_123.mp3',
            call_analysis: {
              call_summary: 'Customer called to enquire about Schneider EV charger installation.',
              user_sentiment: 'Positive',
              call_successful: true,
              custom_analysis_data: {
                charger_brand: 'Schneider',
                property_type: 'Villa',
              },
            },
          },
        },
      };

      let responseData: any = null;
      let statusCode = 0;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseData = data;
              return res;
            },
          };
        },
      };

      await webhookHandler(req, res);

      expect(statusCode).toBe(200);
      expect(responseData.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        'contact_123',
        expect.objectContaining({
          Last_Call_Summary: 'Customer called to enquire about Schneider EV charger installation.',
          Customer_Sentiment: 'Positive',
          Charger_Brand: 'Schneider',
          Property_Type: 'Villa',
        })
      );
    });
  });
});
