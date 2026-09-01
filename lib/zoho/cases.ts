import { zohoClient } from './client.js';
import { logger } from '../logging/logger.js';
import { ZohoMutationResponse } from '../../types/zoho.js';

export interface CreateCaseParams {
  subject: string;
  description: string;
  contactId?: string | null;
  leadId?: string | null;
  phone?: string;
  email?: string;
  sentiment?: string;
  agentName?: string;
  callOutcome?: string;
  recordingUrl?: string;
  callId?: string;
}

/**
 * Automatically creates a Support Case (Ticket) in Zoho CRM under the Cases module
 */
export async function createZohoCase(params: CreateCaseParams): Promise<string | null> {
  const {
    subject,
    description,
    contactId,
    sentiment,
    agentName = 'AI Receptionist (Maryam)',
    callOutcome,
    recordingUrl,
    callId,
  } = params;

  try {
    // Determine priority based on customer sentiment and outcome
    let priority = 'Medium';
    if (sentiment === 'Negative' || callOutcome?.toLowerCase().includes('escalat') || callOutcome?.toLowerCase().includes('urgent')) {
      priority = 'High';
    }

    const fullDescription = [
      description,
      '',
      '--- AI Call Metadata ---',
      `Handled by Agent: ${agentName}`,
      callOutcome ? `Call Outcome: ${callOutcome}` : null,
      sentiment ? `Customer Sentiment: ${sentiment}` : null,
      recordingUrl ? `Call Recording URL: ${recordingUrl}` : null,
      callId ? `Retell Conversation ID: ${callId}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const caseData: Record<string, unknown> = {
      Subject: subject.slice(0, 120),
      Description: fullDescription,
      Status: 'New',
      Priority: priority,
      Case_Origin: 'Phone',
      Type: 'Support / Inquiry',
    };

    // Link to Contact if found
    if (contactId) {
      caseData.Related_To = { id: contactId };
    }

    const payload = {
      data: [caseData],
    };

    logger.info('Creating support Case (Ticket) in Zoho CRM', { contactId: contactId || undefined, subject });

    const response = await zohoClient.post<ZohoMutationResponse>('/Cases', payload);
    const result = response?.data?.[0];

    if (result && result.status === 'success' && result.details?.id) {
      const caseId = result.details.id;
      logger.info('Successfully created Case (Ticket) in Zoho CRM', {
        caseId,
        contactId: contactId || undefined,
      });
      return caseId;
    }

    logger.warn('Zoho CRM returned non-success when creating Case', { result });
    return null;
  } catch (error) {
    logger.error('Error creating Support Case in Zoho CRM', { contactId: contactId || undefined }, error);
    return null;
  }
}
