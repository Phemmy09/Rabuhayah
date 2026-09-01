import { describe, it, expect } from 'vitest';
import { buildCustomerContext, buildRetellDynamicVariables } from '../lib/context/generator.js';
import { NormalizedCustomer } from '../types/common.js';

describe('Customer Context & Dynamic Variables Generator', () => {
  describe('buildCustomerContext', () => {
    it('generates rich context for an existing Contact with company and notes', () => {
      const customer: NormalizedCustomer = {
        found: true,
        module: 'Contacts',
        id: '10001',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        phone: '+2348012345678',
        email: 'john@example.com',
        company: 'ABC Limited',
        leadStatus: null,
        customerType: 'Existing Customer',
        notes: 'Interested in 3-bedroom apartments in Lekki Phase 1',
      };

      const context = buildCustomerContext(customer);
      expect(context).toContain('John Doe from ABC Limited is an existing customer in our CRM.');
      expect(context).toContain('Interested in 3-bedroom apartments in Lekki Phase 1');
    });

    it('generates context for a Lead with status and EV installation properties', () => {
      const customer: NormalizedCustomer = {
        found: true,
        module: 'Leads',
        id: '20002',
        firstName: 'Sarah',
        lastName: 'Connor',
        fullName: 'Sarah Connor',
        phone: '+971509732525',
        email: 'sarah@example.com',
        company: 'Cyberdyne',
        leadStatus: 'Qualified',
        customerType: 'Lead',
        chargerBrand: 'Schneider',
        evModel: 'Tesla Model Y',
        propertyType: 'Villa',
        quotedPackage: '15m Cable Run',
        notes: 'Requested site survey for weekend.',
      };

      const context = buildCustomerContext(customer);
      expect(context).toContain('Sarah Connor from Cyberdyne is a prospective lead in our CRM.');
      expect(context).toContain('Current lead status is Qualified.');
      expect(context).toContain('charger brand: Schneider');
      expect(context).toContain('EV model: Tesla Model Y');
      expect(context).toContain('property type: Villa');
      expect(context).toContain('quoted package: 15m Cable Run');
      expect(context).toContain('Requested site survey for weekend.');
    });

    it('generates fallback message when customer is not found', () => {
      const customer: NormalizedCustomer = {
        found: false,
        module: null,
        id: null,
        firstName: '',
        lastName: '',
        fullName: '',
        phone: '+2348012345678',
        email: '',
        company: '',
        leadStatus: null,
        customerType: 'New Caller',
      };

      const context = buildCustomerContext(customer);
      expect(context).toBe('No existing CRM record was found for this caller. Treat them as a new caller.');
    });
  });

  describe('buildRetellDynamicVariables', () => {
    it('formats dynamic variables matching Retell schema for known customer', () => {
      const customer: NormalizedCustomer = {
        found: true,
        module: 'Contacts',
        id: '30003',
        firstName: 'Ahmed',
        lastName: 'Al-Maktoum',
        fullName: 'Ahmed Al-Maktoum',
        phone: '+971509732525',
        email: 'ahmed@example.com',
        company: 'Al Maktoum Holdings',
        leadStatus: null,
        customerType: 'Existing Customer',
        chargerBrand: 'Kempower',
      };

      const vars = buildRetellDynamicVariables(customer, 'agent-receptionist');

      expect(vars.customer_found).toBe('true');
      expect(vars.customer_name).toBe('Ahmed Al-Maktoum');
      expect(vars.first_name).toBe('Ahmed');
      expect(vars.last_name).toBe('Al-Maktoum');
      expect(vars.customer_phone).toBe('+971509732525');
      expect(vars.customer_email).toBe('ahmed@example.com');
      expect(vars.company_name).toBe('Al Maktoum Holdings');
      expect(vars.customer_type).toBe('Existing Customer');
      expect(vars.crm_module).toBe('Contacts');
      expect(vars.crm_record_id).toBe('30003');
      expect(vars.charger_brand).toBe('Kempower');
      expect(vars.agent_id).toBe('agent-receptionist');
      expect(typeof vars.customer_context).toBe('string');
    });

    it('formats dynamic variables correctly for unknown caller', () => {
      const customer: NormalizedCustomer = {
        found: false,
        module: null,
        id: null,
        firstName: '',
        lastName: '',
        fullName: '',
        phone: '+2348012345678',
        email: '',
        company: '',
        leadStatus: null,
        customerType: 'New Caller',
      };

      const vars = buildRetellDynamicVariables(customer);

      expect(vars.customer_found).toBe('false');
      expect(vars.customer_name).toBe('');
      expect(vars.first_name).toBe('there');
      expect(vars.last_name).toBe('');
      expect(vars.customer_phone).toBe('+2348012345678');
      expect(vars.customer_email).toBe('');
      expect(vars.customer_type).toBe('New Caller');
      expect(vars.crm_module).toBe('');
      expect(vars.crm_record_id).toBe('');
    });
  });
});
