import { zohoClient } from './client.js';
import { logger } from '../logging/logger.js';
import { ZohoContactRecord, ZohoSearchResponse, ZohoMutationResponse } from '../../types/zoho.js';
import { normalizePhone } from '../phone/normalize.js';

/**
 * Searches for a Contact record in Zoho CRM by phone number
 */
export async function searchContactByPhone(phone: string): Promise<ZohoContactRecord | null> {
  const norm = normalizePhone(phone);
  const searchValues = norm.variations.length > 0 ? norm.variations : [phone];

  for (const queryPhone of searchValues) {
    try {
      const response = await zohoClient.get<ZohoSearchResponse<ZohoContactRecord>>('/Contacts/search', {
        phone: queryPhone,
      });

      if (response && response.data && response.data.length > 0) {
        const contact = response.data[0];
        logger.info('Contact found by phone search in Zoho', {
          module: 'Contacts',
          recordId: contact.id,
          phone: queryPhone,
        });
        return contact;
      }
    } catch (error) {
      logger.debug('Contact phone variation search yielded no match or error', { queryPhone }, error);
    }
  }

  // Also try searching criteria across Phone and Mobile if standard search had no hits
  if (norm.e164) {
    try {
      const criteria = `((Phone:equals:${norm.e164})or(Mobile:equals:${norm.e164}))`;
      const response = await zohoClient.get<ZohoSearchResponse<ZohoContactRecord>>('/Contacts/search', {
        criteria,
      });

      if (response && response.data && response.data.length > 0) {
        return response.data[0];
      }
    } catch (critError) {
      logger.debug('Contact criteria search did not find match', { phone }, critError);
    }
  }

  return null;
}

/**
 * Retrieves a Contact record by Zoho Record ID
 */
export async function getContact(id: string): Promise<ZohoContactRecord | null> {
  try {
    const response = await zohoClient.get<ZohoSearchResponse<ZohoContactRecord>>(`/Contacts/${id}`);
    if (response && response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    logger.error('Failed to get Contact by ID', { recordId: id }, error);
    return null;
  }
}

/**
 * Updates a Contact record in Zoho CRM
 */
export async function updateContact(
  id: string,
  data: Record<string, unknown>
): Promise<boolean> {
  try {
    const payload = {
      data: [{ id, ...data }],
    };

    const response = await zohoClient.put<ZohoMutationResponse>(`/Contacts/${id}`, payload);
    const result = response?.data?.[0];

    if (result && result.status === 'success') {
      logger.info('Successfully updated Contact in Zoho CRM', {
        module: 'Contacts',
        recordId: id,
      });
      return true;
    }

    logger.warn('Zoho returned non-success for Contact update', {
      recordId: id,
      result,
    });
    return false;
  } catch (error) {
    logger.error('Error updating Contact in Zoho CRM', { recordId: id }, error);
    return false;
  }
}

/**
 * Creates a new Contact record in Zoho CRM
 */
export async function createContact(
  data: Record<string, unknown>
): Promise<string | null> {
  try {
    const payload = {
      data: [data],
    };

    const response = await zohoClient.post<ZohoMutationResponse>('/Contacts', payload);
    const result = response?.data?.[0];

    if (result && result.status === 'success' && result.details?.id) {
      logger.info('Successfully created Contact in Zoho CRM', {
        module: 'Contacts',
        recordId: result.details.id,
      });
      return result.details.id;
    }

    logger.warn('Failed to create Contact in Zoho CRM', { result });
    return null;
  } catch (error) {
    logger.error('Error creating Contact in Zoho CRM', undefined, error);
    return null;
  }
}
