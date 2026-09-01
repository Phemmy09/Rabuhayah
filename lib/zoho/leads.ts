import { zohoClient } from './client.js';
import { logger } from '../logging/logger.js';
import { ZohoLeadRecord, ZohoSearchResponse, ZohoMutationResponse } from '../../types/zoho.js';
import { normalizePhone } from '../phone/normalize.js';

/**
 * Searches for a Lead record in Zoho CRM by phone number
 */
export async function searchLeadByPhone(phone: string): Promise<ZohoLeadRecord | null> {
  const norm = normalizePhone(phone);
  const searchValues = norm.variations.length > 0 ? norm.variations : [phone];

  for (const queryPhone of searchValues) {
    try {
      const response = await zohoClient.get<ZohoSearchResponse<ZohoLeadRecord>>('/Leads/search', {
        phone: queryPhone,
      });

      if (response && response.data && response.data.length > 0) {
        const lead = response.data[0];
        logger.info('Lead found by phone search in Zoho', {
          module: 'Leads',
          recordId: lead.id,
          phone: queryPhone,
        });
        return lead;
      }
    } catch (error) {
      logger.debug('Lead phone search variation yielded no match or error', { queryPhone }, error);
    }
  }

  // Also try searching criteria across Phone and Mobile
  if (norm.e164 || norm.nationalNumber) {
    try {
      const digits = norm.nationalNumber || norm.e164.replace(/\D/g, '');
      const searchTerms = [norm.e164, digits, `0${digits}`, norm.raw].filter(Boolean);
      const orClauses = searchTerms.flatMap((t) => [`(Phone:equals:${t})`, `(Mobile:equals:${t})`]).join('or');
      const criteria = `(${orClauses})`;

      const response = await zohoClient.get<ZohoSearchResponse<ZohoLeadRecord>>('/Leads/search', {
        criteria,
      });

      if (response && response.data && response.data.length > 0) {
        return response.data[0];
      }
    } catch (critError) {
      logger.debug('Lead criteria search did not find match', { phone }, critError);
    }

    // Word search fallback with last 8-9 digits
    if (norm.nationalNumber && norm.nationalNumber.length >= 7) {
      try {
        const response = await zohoClient.get<ZohoSearchResponse<ZohoLeadRecord>>('/Leads/search', {
          word: norm.nationalNumber,
        });
        if (response && response.data && response.data.length > 0) {
          logger.info('Lead found via phone word search fallback', { recordId: response.data[0].id });
          return response.data[0];
        }
      } catch (wordError) {
        logger.debug('Lead word search fallback had no results', { phone }, wordError);
      }
    }
  }

  return null;
}

/**
 * Searches for a Lead record in Zoho CRM by email address
 */
export async function searchLeadByEmail(email: string): Promise<ZohoLeadRecord | null> {
  if (!email || !email.includes('@')) return null;

  try {
    const response = await zohoClient.get<ZohoSearchResponse<ZohoLeadRecord>>('/Leads/search', {
      email: email.trim(),
    });

    if (response && response.data && response.data.length > 0) {
      return response.data[0];
    }
  } catch (error) {
    logger.debug('Lead email search failed or had no results', { email }, error);
  }

  return null;
}

/**
 * Retrieves a Lead record by Zoho Record ID
 */
export async function getLead(id: string): Promise<ZohoLeadRecord | null> {
  try {
    const response = await zohoClient.get<ZohoSearchResponse<ZohoLeadRecord>>(`/Leads/${id}`);
    if (response && response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    logger.error('Failed to get Lead by ID', { recordId: id }, error);
    return null;
  }
}

/**
 * Updates a Lead record in Zoho CRM
 */
export async function updateLead(
  id: string,
  data: Record<string, unknown>
): Promise<boolean> {
  try {
    const payload = {
      data: [{ id, ...data }],
    };

    const response = await zohoClient.put<ZohoMutationResponse>(`/Leads/${id}`, payload);
    const result = response?.data?.[0];

    if (result && result.status === 'success') {
      logger.info('Successfully updated Lead in Zoho CRM', {
        module: 'Leads',
        recordId: id,
      });
      return true;
    }

    logger.warn('Zoho returned non-success for Lead update', {
      recordId: id,
      result,
    });
    return false;
  } catch (error) {
    logger.error('Error updating Lead in Zoho CRM', { recordId: id }, error);
    return false;
  }
}

/**
 * Creates a new Lead record in Zoho CRM
 */
export async function createLead(
  data: Record<string, unknown>
): Promise<string | null> {
  try {
    // Zoho CRM requires Last_Name and Company fields for Lead creation
    const payloadData: Record<string, unknown> = {
      Last_Name: data.Last_Name || data.Last_name || 'Caller',
      Company: data.Company || 'Individual',
      ...data,
    };

    const payload = {
      data: [payloadData],
    };

    const response = await zohoClient.post<ZohoMutationResponse>('/Leads', payload);
    const result = response?.data?.[0];

    if (result && result.status === 'success' && result.details?.id) {
      logger.info('Successfully created Lead in Zoho CRM', {
        module: 'Leads',
        recordId: result.details.id,
      });
      return result.details.id;
    }

    logger.warn('Failed to create Lead in Zoho CRM', { result });
    return null;
  } catch (error) {
    logger.error('Error creating Lead in Zoho CRM', undefined, error);
    return null;
  }
}

/**
 * Duplicate-protected Lead creation:
 * Searches by phone and email first; if existing lead found, updates it instead of creating duplicate.
 */
export async function createLeadIfNotExists(
  data: Record<string, unknown>,
  phone?: string,
  email?: string
): Promise<{ id: string | null; isNew: boolean }> {
  // 1. Search by phone
  if (phone) {
    const existingByPhone = await searchLeadByPhone(phone);
    if (existingByPhone) {
      logger.info('Found existing lead by phone, updating instead of creating duplicate', {
        leadId: existingByPhone.id,
        phone,
      });
      await updateLead(existingByPhone.id, data);
      return { id: existingByPhone.id, isNew: false };
    }
  }

  // 2. Search by email
  if (email) {
    const existingByEmail = await searchLeadByEmail(email);
    if (existingByEmail) {
      logger.info('Found existing lead by email, updating instead of creating duplicate', {
        leadId: existingByEmail.id,
        email,
      });
      await updateLead(existingByEmail.id, data);
      return { id: existingByEmail.id, isNew: false };
    }
  }

  // 3. Create new lead
  const newId = await createLead(data);
  return { id: newId, isNew: true };
}
