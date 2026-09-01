import { searchContactByPhone } from './contacts.js';
import { searchLeadByPhone } from './leads.js';
import { normalizePhone } from '../phone/normalize.js';
import { logger } from '../logging/logger.js';
import { config } from '../config.js';
import { NormalizedCustomer } from '../../types/common.js';
import { ZohoContactRecord, ZohoLeadRecord } from '../../types/zoho.js';
import { ZOHO_FIELD_MAP } from './field-mapping.js';

/**
 * Normalizes a raw Contact record into a standardized customer format
 */
export function normalizeContact(contact: ZohoContactRecord, queriedPhone: string): NormalizedCustomer {
  let firstName = contact.First_Name || '';
  let lastName = contact.Last_Name || '';
  let fullName = contact.Full_Name || `${firstName} ${lastName}`.trim();

  // Filter out placeholder names like "Unknown Caller" or raw phone numbers
  const isPlaceholder = (n: string) => !n || n.toLowerCase().includes('unknown') || /^\+?\d+$/.test(n.replace(/\s+/g, ''));
  if (isPlaceholder(firstName)) firstName = '';
  if (isPlaceholder(lastName)) lastName = '';
  if (isPlaceholder(fullName)) fullName = firstName ? `${firstName} ${lastName}`.trim() : '';

  const phone = contact.Phone || contact.Mobile || queriedPhone;
  const email = contact.Email || '';
  const company = contact.Account_Name?.name || contact.Department || '';

  // Extract optional custom properties if present
  const chargerBrand = (contact[ZOHO_FIELD_MAP.chargerBrand] as string) || undefined;
  const evModel = (contact[ZOHO_FIELD_MAP.evModel] as string) || undefined;
  const propertyType = (contact[ZOHO_FIELD_MAP.propertyType] as string) || undefined;
  const quotedPackage = (contact[ZOHO_FIELD_MAP.quotedPackage] as string) || undefined;
  const notes = (contact[ZOHO_FIELD_MAP.lastCallSummary] as string) || contact.Description || undefined;

  return {
    found: true,
    module: 'Contacts',
    id: contact.id,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    fullName: fullName || undefined,
    phone,
    email,
    company,
    leadStatus: null,
    customerType: 'Existing Customer',
    notes,
    chargerBrand,
    evModel,
    propertyType,
    quotedPackage,
    rawRecord: contact,
  };
}

/**
 * Normalizes a raw Lead record into a standardized customer format
 */
export function normalizeLead(lead: ZohoLeadRecord, queriedPhone: string): NormalizedCustomer {
  let firstName = lead.First_Name || '';
  let lastName = lead.Last_Name || '';
  let fullName = lead.Full_Name || `${firstName} ${lastName}`.trim();

  const isPlaceholder = (n: string) => !n || n.toLowerCase().includes('unknown') || /^\+?\d+$/.test(n.replace(/\s+/g, ''));
  if (isPlaceholder(firstName)) firstName = '';
  if (isPlaceholder(lastName)) lastName = '';
  if (isPlaceholder(fullName)) fullName = firstName ? `${firstName} ${lastName}`.trim() : '';

  const phone = lead.Phone || lead.Mobile || queriedPhone;
  const email = lead.Email || '';
  const company = lead.Company && lead.Company !== 'Individual' ? lead.Company : '';
  const leadStatus = lead.Lead_Status || 'Open';

  // Extract optional custom properties if present
  const chargerBrand = (lead[ZOHO_FIELD_MAP.chargerBrand] as string) || undefined;
  const evModel = (lead[ZOHO_FIELD_MAP.evModel] as string) || undefined;
  const propertyType = (lead[ZOHO_FIELD_MAP.propertyType] as string) || undefined;
  const quotedPackage = (lead[ZOHO_FIELD_MAP.quotedPackage] as string) || undefined;
  const notes = (lead[ZOHO_FIELD_MAP.lastCallSummary] as string) || lead.Description || undefined;

  return {
    found: true,
    module: 'Leads',
    id: lead.id,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    fullName: fullName || undefined,
    phone,
    email,
    company,
    leadStatus,
    customerType: 'Lead',
    notes,
    chargerBrand,
    evModel,
    propertyType,
    quotedPackage,
    rawRecord: lead,
  };
}

/**
 * Unified customer lookup:
 * Searches Zoho Contacts first, then Zoho Leads.
 * Fails gracefully and returns a standardized { found: false } object if not found or if CRM fails.
 */
export async function findCustomerByPhone(phone: string): Promise<NormalizedCustomer> {
  const normalized = normalizePhone(phone);
  const searchPhone = normalized.e164 || phone;

  const startTime = Date.now();
  logger.info('Starting customer search across Zoho CRM', { phone: searchPhone });

  // 1. Search Contacts first
  if (config.business.searchContactsFirst) {
    try {
      const contact = await searchContactByPhone(searchPhone);
      if (contact) {
        const customer = normalizeContact(contact, searchPhone);
        logger.info('Customer match found in Contacts', {
          durationMs: Date.now() - startTime,
          module: 'Contacts',
          recordId: customer.id || undefined,
        });
        return customer;
      }
    } catch (contactError) {
      logger.warn('Error during Zoho Contacts search, continuing to Leads search', undefined, contactError);
    }
  }

  // 2. Search Leads second
  if (config.business.searchLeadsSecond) {
    try {
      const lead = await searchLeadByPhone(searchPhone);
      if (lead) {
        const customer = normalizeLead(lead, searchPhone);
        logger.info('Customer match found in Leads', {
          durationMs: Date.now() - startTime,
          module: 'Leads',
          recordId: customer.id || undefined,
        });
        return customer;
      }
    } catch (leadError) {
      logger.warn('Error during Zoho Leads search', undefined, leadError);
    }
  }

  // 3. No match found
  logger.info('No existing Contact or Lead found for caller', {
    durationMs: Date.now() - startTime,
    phone: searchPhone,
  });

  return {
    found: false,
    module: null,
    id: null,
    firstName: '',
    lastName: '',
    fullName: '',
    phone: searchPhone,
    email: '',
    company: '',
    leadStatus: null,
    customerType: 'New Caller',
    notes: undefined,
  };
}
