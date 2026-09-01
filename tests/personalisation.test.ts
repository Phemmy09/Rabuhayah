import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizePhone } from '../lib/phone/normalize.js';
import { normalizeContact, normalizeLead, findCustomerByPhone } from '../lib/zoho/customer.js';
import { buildCustomerContext, buildRetellDynamicVariables } from '../lib/context/generator.js';
import inboundHandler from '../api/retell/inbound.js';
import * as customerResolver from '../lib/zoho/customer.js';
import { NormalizedCustomer } from '../types/common.js';
import { ZohoContactRecord, ZohoLeadRecord } from '../types/zoho.js';

/**
 * PERSONALIZATION END-TO-END VERIFICATION TESTS
 *
 * These tests prove that when a client calls in, the system:
 * 1. Normalizes the phone number correctly
 * 2. Finds the right CRM record (Contact or Lead)
 * 3. Generates a rich, personalized context string
 * 4. Builds all dynamic variables for the Retell AI prompt
 * 5. Returns the correct Retell-compliant response structure
 */
describe('Personalization Pipeline — End-to-End Verification', () => {
  // ============================================================
  // STAGE 1: Phone Normalization → CRM Lookup Ready
  // ============================================================
  describe('Stage 1: Phone normalization produces correct search values', () => {
    it('UAE mobile number (0509732525) normalizes to E.164 and produces search variations', () => {
      const result = normalizePhone('0509732525', 'AE');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+971509732525');
      expect(result.variations).toContain('+971509732525');
      expect(result.variations).toContain('971509732525');
      expect(result.variations).toContain('509732525');
      expect(result.variations).toContain('0509732525');
    });

    it('Nigerian mobile number (08012345678) normalizes to E.164', () => {
      const result = normalizePhone('08012345678', 'NG');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+2348012345678');
    });

    it('Already E.164 number passes through', () => {
      const result = normalizePhone('+971509732525');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+971509732525');
    });

    it('Bare digits (971509732525) are normalized', () => {
      const result = normalizePhone('971509732525', 'AE');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+971509732525');
    });
  });

  // ============================================================
  // STAGE 2: CRM Record Normalization → Correct Customer Object
  // ============================================================
  describe('Stage 2: CRM record normalization produces correct customer object', () => {
    it('normalizeContact produces all personalization fields from a rich Contact record', () => {
      const rawContact: ZohoContactRecord = {
        id: 'contact_abc',
        First_Name: 'Mohammed',
        Last_Name: 'Al-Rashid',
        Full_Name: 'Mohammed Al-Rashid',
        Email: 'mohammed@catec.ae',
        Phone: '+971509732525',
        Mobile: null,
        Account_Name: { id: 'acc_001', name: 'CATEC Electric' },
        Title: 'Operations Manager',
        Department: null,
        Lead_Source: 'Website',
        // Custom fields that map via ZOHO_FIELD_MAP
        Charger_Brand: 'ABB',
        EV_Make_Model: 'BMW iX',
        Property_Type: 'Commercial',
        Quoted_Package: '100kW DC Fast Charger',
        Last_Call_Summary: 'Called about warranty extension for existing chargers.',
      };

      const customer = normalizeContact(rawContact, '+971509732525');

      expect(customer.found).toBe(true);
      expect(customer.module).toBe('Contacts');
      expect(customer.id).toBe('contact_abc');
      expect(customer.firstName).toBe('Mohammed');
      expect(customer.lastName).toBe('Al-Rashid');
      expect(customer.fullName).toBe('Mohammed Al-Rashid');
      expect(customer.email).toBe('mohammed@catec.ae');
      expect(customer.phone).toBe('+971509732525');
      expect(customer.company).toBe('CATEC Electric');
      expect(customer.customerType).toBe('Existing Customer');
      expect(customer.chargerBrand).toBe('ABB');
      expect(customer.evModel).toBe('BMW iX');
      expect(customer.propertyType).toBe('Commercial');
      expect(customer.quotedPackage).toBe('100kW DC Fast Charger');
      expect(customer.notes).toBe('Called about warranty extension for existing chargers.');
    });

    it('normalizeLead produces lead-specific personalization fields', () => {
      const rawLead: ZohoLeadRecord = {
        id: 'lead_xyz',
        First_Name: 'Fatima',
        Last_Name: 'Hassan',
        Full_Name: 'Fatima Hassan',
        Email: 'fatima@gmail.com',
        Phone: '+971501234567',
        Mobile: null,
        Company: 'Individual',
        Lead_Status: 'Contacted',
        Lead_Source: 'AI Voice Agent',
        Designation: null,
        Industry: null,
      };

      const customer = normalizeLead(rawLead, '+971501234567');

      expect(customer.found).toBe(true);
      expect(customer.module).toBe('Leads');
      expect(customer.customerType).toBe('Lead');
      expect(customer.leadStatus).toBe('Contacted');
      expect(customer.firstName).toBe('Fatima');
      expect(customer.fullName).toBe('Fatima Hassan');
      // Company "Individual" should be filtered out
      expect(customer.company).toBe('');
    });

    it('filters out placeholder names like "Unknown Caller" or phone numbers as names', () => {
      const rawContact: ZohoContactRecord = {
        id: 'contact_placeholder',
        First_Name: 'Unknown',
        Last_Name: '+971509732525',
        Full_Name: 'Unknown +971509732525',
        Email: null,
        Phone: '+971509732525',
        Mobile: null,
        Account_Name: null,
        Title: null,
        Department: null,
        Lead_Source: null,
      };

      const customer = normalizeContact(rawContact, '+971509732525');

      // Placeholder names should be filtered to empty strings, not undefined
      expect(customer.firstName).toBe('');
      expect(customer.lastName).toBe('');
      expect(customer.fullName).toBe('');
      // TypeScript types should be satisfied (string, not undefined)
      expect(typeof customer.firstName).toBe('string');
      expect(typeof customer.lastName).toBe('string');
      expect(typeof customer.fullName).toBe('string');
    });
  });

  // ============================================================
  // STAGE 3: Context Generation → Natural Language Personalization
  // ============================================================
  describe('Stage 3: Context generator produces natural language personalization', () => {
    it('generates rich context with name, company, preferences, and history', () => {
      const customer: NormalizedCustomer = {
        found: true,
        module: 'Contacts',
        id: 'c_001',
        firstName: 'Ahmed',
        lastName: 'Al-Sayed',
        fullName: 'Ahmed Al-Sayed',
        phone: '+971509732525',
        email: 'ahmed@example.com',
        company: 'Dubai Malls LLC',
        leadStatus: null,
        customerType: 'Existing Customer',
        chargerBrand: 'Schneider',
        evModel: 'Tesla Model 3',
        propertyType: 'Commercial',
        quotedPackage: '22kW AC Charger',
        notes: 'Called last week about installing 10 chargers in parking lot.',
      };

      const context = buildCustomerContext(customer);

      expect(context).toContain('Ahmed Al-Sayed from Dubai Malls LLC is an existing customer');
      expect(context).toContain('charger brand: Schneider');
      expect(context).toContain('EV model: Tesla Model 3');
      expect(context).toContain('property type: Commercial');
      expect(context).toContain('quoted package: 22kW AC Charger');
      expect(context).toContain('installing 10 chargers');
    });

    it('generates lead-specific context with status', () => {
      const customer: NormalizedCustomer = {
        found: true,
        module: 'Leads',
        id: 'l_002',
        firstName: 'Sara',
        lastName: '',
        fullName: 'Sara',
        phone: '+971501111111',
        email: '',
        company: '',
        leadStatus: 'Qualified',
        customerType: 'Lead',
      };

      const context = buildCustomerContext(customer);

      expect(context).toContain('Sara is a prospective lead');
      expect(context).toContain('Current lead status is Qualified');
    });

    it('handles filtered-out names gracefully (uses "The caller" instead)', () => {
      const customer: NormalizedCustomer = {
        found: true,
        module: 'Contacts',
        id: 'c_anon',
        firstName: '',
        lastName: '',
        fullName: '',
        phone: '+971509732525',
        email: '',
        company: '',
        leadStatus: null,
        customerType: 'Existing Customer',
      };

      const context = buildCustomerContext(customer);

      // When fullName and firstName are empty, the generator should use "The caller"
      expect(context).toContain('The caller is an existing customer');
    });
  });

  // ============================================================
  // STAGE 4: Dynamic Variables → Retell-Compliant Output
  // ============================================================
  describe('Stage 4: Dynamic variables match Retell schema exactly', () => {
    it('all required fields are strings (never undefined) for known customer', () => {
      const customer: NormalizedCustomer = {
        found: true,
        module: 'Contacts',
        id: 'c_099',
        firstName: 'Omar',
        lastName: 'Khan',
        fullName: 'Omar Khan',
        phone: '+971509732525',
        email: 'omar@khan.com',
        company: 'Khan Industries',
        leadStatus: null,
        customerType: 'Existing Customer',
        chargerBrand: 'Delta',
        evModel: 'Audi e-tron',
      };

      const vars = buildRetellDynamicVariables(customer, 'agent_42eeb5d0bd58551aa744b7b003');

      // ALL values must be strings
      expect(typeof vars.customer_found).toBe('string');
      expect(typeof vars.customer_name).toBe('string');
      expect(typeof vars.first_name).toBe('string');
      expect(typeof vars.last_name).toBe('string');
      expect(typeof vars.customer_phone).toBe('string');
      expect(typeof vars.customer_email).toBe('string');
      expect(typeof vars.company_name).toBe('string');
      expect(typeof vars.customer_type).toBe('string');
      expect(typeof vars.lead_status).toBe('string');
      expect(typeof vars.customer_interest).toBe('string');
      expect(typeof vars.customer_context).toBe('string');

      // Personalization values
      expect(vars.customer_found).toBe('true');
      expect(vars.customer_name).toBe('Omar Khan');
      expect(vars.first_name).toBe('Omar');
      expect(vars.last_name).toBe('Khan');
      expect(vars.company_name).toBe('Khan Industries');
      expect(vars.customer_type).toBe('Existing Customer');
      expect(vars.charger_brand).toBe('Delta');
      expect(vars.ev_model).toBe('Audi e-tron');
      expect(vars.agent_id).toBe('agent_42eeb5d0bd58551aa744b7b003');

      // Context should be a rich sentence, not empty
      expect(vars.customer_context.length).toBeGreaterThan(20);
      expect(vars.customer_context).toContain('Omar Khan');
    });

    it('unknown caller gets safe defaults with "there" as first_name', () => {
      const customer: NormalizedCustomer = {
        found: false,
        module: null,
        id: null,
        firstName: '',
        lastName: '',
        fullName: '',
        phone: '+971551234567',
        email: '',
        company: '',
        leadStatus: null,
        customerType: 'New Caller',
      };

      const vars = buildRetellDynamicVariables(customer);

      expect(vars.customer_found).toBe('false');
      expect(vars.first_name).toBe('there');
      expect(vars.customer_name).toBe('');
      expect(vars.customer_type).toBe('New Caller');
      expect(vars.customer_context).toContain('new caller');
    });

    it('placeholder-filtered customer still produces valid string dynamic variables', () => {
      const customer: NormalizedCustomer = {
        found: true,
        module: 'Contacts',
        id: 'c_filtered',
        firstName: '',
        lastName: '',
        fullName: '',
        phone: '+971509732525',
        email: '',
        company: '',
        leadStatus: null,
        customerType: 'Existing Customer',
      };

      const vars = buildRetellDynamicVariables(customer);

      // Even with empty names, we should never get undefined
      expect(vars.customer_found).toBe('true');
      expect(vars.first_name).toBe('there'); // Fallback
      expect(vars.customer_name).toBe(''); // Empty, not undefined
      expect(vars.customer_type).toBe('Existing Customer');
      expect(typeof vars.customer_context).toBe('string');
    });
  });

  // ============================================================
  // STAGE 5: Full Inbound Handler → Retell Response Structure
  // ============================================================
  describe('Stage 5: Inbound handler returns correct Retell response with personalization', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('returns personalized dynamic variables for known UAE Contact', async () => {
      vi.spyOn(customerResolver, 'findCustomerByPhone').mockResolvedValueOnce({
        found: true,
        module: 'Contacts',
        id: 'contact_uae_001',
        firstName: 'Khalid',
        lastName: 'Al-Mansoori',
        fullName: 'Khalid Al-Mansoori',
        phone: '+971509732525',
        email: 'khalid@catec.ae',
        company: 'CATEC Electric',
        leadStatus: null,
        customerType: 'Existing Customer',
        chargerBrand: 'ABB',
        evModel: 'BMW iX',
        propertyType: 'Villa',
        notes: 'Has 3 chargers already installed. VIP customer.',
      });

      const req: any = {
        method: 'POST',
        headers: {},
        body: {
          event: 'call_inbound',
          call_inbound: {
            from_number: '+971509732525',
            to_number: '+971026591000',
            agent_id: 'agent_42eeb5d0bd58551aa744b7b003',
          },
        },
      };

      let responseData: any = null;
      let statusCode = 0;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (data: any) => { responseData = data; return res; } };
        },
      };

      await inboundHandler(req, res);

      // Response structure must match Retell spec
      expect(statusCode).toBe(200);
      expect(responseData).toHaveProperty('call_inbound');
      expect(responseData.call_inbound).toHaveProperty('dynamic_variables');

      const dv = responseData.call_inbound.dynamic_variables;

      // Core personalization checks
      expect(dv.customer_found).toBe('true');
      expect(dv.customer_name).toBe('Khalid Al-Mansoori');
      expect(dv.first_name).toBe('Khalid');
      expect(dv.last_name).toBe('Al-Mansoori');
      expect(dv.customer_email).toBe('khalid@catec.ae');
      expect(dv.company_name).toBe('CATEC Electric');
      expect(dv.customer_type).toBe('Existing Customer');
      expect(dv.charger_brand).toBe('ABB');
      expect(dv.ev_model).toBe('BMW iX');
      expect(dv.property_type).toBe('Villa');

      // Context should contain personalization
      expect(dv.customer_context).toContain('Khalid Al-Mansoori');
      expect(dv.customer_context).toContain('CATEC Electric');
      expect(dv.customer_context).toContain('existing customer');
      expect(dv.customer_context).toContain('VIP customer');

      // Agent ID should be passed through
      expect(responseData.call_inbound.agent_id).toBe('agent_42eeb5d0bd58551aa744b7b003');
    });

    it('returns personalized dynamic variables for known Lead with status', async () => {
      vi.spyOn(customerResolver, 'findCustomerByPhone').mockResolvedValueOnce({
        found: true,
        module: 'Leads',
        id: 'lead_009',
        firstName: 'Layla',
        lastName: 'Ibrahim',
        fullName: 'Layla Ibrahim',
        phone: '+971551234567',
        email: 'layla@gmail.com',
        company: '',
        leadStatus: 'Contacted',
        customerType: 'Lead',
        quotedPackage: '7kW Home Charger',
      });

      const req: any = {
        method: 'POST',
        headers: {},
        body: {
          event: 'call_inbound',
          call_inbound: {
            from_number: '+971551234567',
            to_number: '+971026591000',
          },
        },
      };

      let responseData: any = null;
      let statusCode = 0;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (data: any) => { responseData = data; return res; } };
        },
      };

      await inboundHandler(req, res);

      expect(statusCode).toBe(200);

      const dv = responseData.call_inbound.dynamic_variables;
      expect(dv.customer_found).toBe('true');
      expect(dv.first_name).toBe('Layla');
      expect(dv.customer_type).toBe('Lead');
      expect(dv.lead_status).toBe('Contacted');
      expect(dv.quoted_package).toBe('7kW Home Charger');
      expect(dv.customer_context).toContain('prospective lead');
      expect(dv.customer_context).toContain('Contacted');
    });

    it('handles CRM error gracefully and still returns valid response', async () => {
      vi.spyOn(customerResolver, 'findCustomerByPhone').mockRejectedValueOnce(
        new Error('Zoho CRM timeout')
      );

      const req: any = {
        method: 'POST',
        headers: {},
        body: {
          event: 'call_inbound',
          call_inbound: {
            from_number: '+971509732525',
            to_number: '+971026591000',
            agent_id: 'agent_42eeb5d0bd58551aa744b7b003',
          },
        },
      };

      let responseData: any = null;
      let statusCode = 0;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (data: any) => { responseData = data; return res; } };
        },
      };

      await inboundHandler(req, res);

      // Must ALWAYS return 200 to prevent Retell from dropping the call
      expect(statusCode).toBe(200);
      expect(responseData).toHaveProperty('call_inbound');
      expect(responseData.call_inbound).toHaveProperty('dynamic_variables');

      const dv = responseData.call_inbound.dynamic_variables;
      expect(dv.customer_found).toBe('false');
      expect(dv.customer_type).toBe('New Caller');
      expect(dv.crm_lookup_status).toBe('unavailable');
      // Agent ID should still be passed through
      expect(responseData.call_inbound.agent_id).toBe('agent_42eeb5d0bd58551aa744b7b003');
    });

    it('handles missing from_number with safe fallback (never drops the call)', async () => {
      const req: any = {
        method: 'POST',
        headers: {},
        body: {
          event: 'call_inbound',
          call_inbound: {
            to_number: '+971026591000',
            agent_id: 'agent_test',
            // NOTE: from_number is MISSING
          },
        },
      };

      let responseData: any = null;
      let statusCode = 0;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (data: any) => { responseData = data; return res; } };
        },
      };

      await inboundHandler(req, res);

      expect(statusCode).toBe(200);
      const dv = responseData.call_inbound.dynamic_variables;
      expect(dv.customer_found).toBe('false');
      expect(dv.customer_context).toContain('No caller phone number');
    });

    it('handles completely empty body with safe fallback', async () => {
      const req: any = {
        method: 'POST',
        headers: {},
        body: {},
      };

      let responseData: any = null;
      let statusCode = 0;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (data: any) => { responseData = data; return res; } };
        },
      };

      await inboundHandler(req, res);

      // Must still return 200 with fallback - never reject an inbound call
      expect(statusCode).toBe(200);
      expect(responseData.call_inbound.dynamic_variables.customer_found).toBe('false');
    });
  });
});
