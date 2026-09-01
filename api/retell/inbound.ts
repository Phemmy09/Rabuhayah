import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyRetellWebhook } from '../../lib/retell/verification.js';
import { normalizePhone } from '../../lib/phone/normalize.js';
import { findCustomerByPhone } from '../../lib/zoho/customer.js';
import { buildRetellDynamicVariables } from '../../lib/context/generator.js';
import { logger } from '../../lib/logging/logger.js';
import { RetellInboundWebhookRequest, RetellInboundWebhookResponse } from '../../types/retell.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();

  // 1. Method check
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
    });
  }

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const signature = req.headers['x-retell-signature'];

  // 2. Webhook signature verification
  const isVerified = verifyRetellWebhook(rawBody, signature);
  if (!isVerified) {
    logger.warn('Unauthorized inbound webhook attempt: invalid signature');
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid Retell webhook signature' },
    });
  }

  const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as RetellInboundWebhookRequest;
  const inboundData = payload?.call_inbound;

  // 3. Validate inbound payload
  if (!inboundData || !inboundData.from_number) {
    logger.warn('Inbound webhook missing from_number or call_inbound object', undefined, payload);
    // Respond with safe fallback dynamic variables so call doesn't fail
    const fallbackResponse: RetellInboundWebhookResponse = {
      call_inbound: {
        dynamic_variables: {
          customer_found: 'false',
          customer_name: '',
          first_name: '',
          last_name: '',
          customer_phone: '',
          customer_email: '',
          company_name: '',
          customer_type: 'New Caller',
          lead_status: '',
          customer_interest: '',
          customer_context: 'No caller phone number was received in the inbound request.',
        },
      },
    };
    return res.status(200).json(fallbackResponse);
  }

  const rawCallerNumber = inboundData.from_number;
  const agentId = inboundData.agent_id;
  const normalizedPhone = normalizePhone(rawCallerNumber);
  const searchPhone = normalizedPhone.e164 || rawCallerNumber;

  logger.info('Received inbound call webhook from Retell AI', {
    phone: searchPhone,
    agentId,
    isValidPhone: normalizedPhone.isValid,
  });

  try {
    // 4. Perform customer search in Zoho CRM (Contacts -> Leads)
    const customer = await findCustomerByPhone(searchPhone);

    // 5. Generate dynamic variables for voice agent prompt
    const dynamicVariables = buildRetellDynamicVariables(customer, agentId);

    const responsePayload: RetellInboundWebhookResponse = {
      call_inbound: {
        ...(agentId ? { agent_id: agentId } : {}),
        dynamic_variables: dynamicVariables,
      },
    };

    const durationMs = Date.now() - startTime;
    logger.info('Returning dynamic variables to Retell AI', {
      durationMs,
      phone: searchPhone,
      customerFound: customer.found,
      module: customer.module || 'None',
      recordId: customer.id || undefined,
    });

    return res.status(200).json(responsePayload);
  } catch (error) {
    // 6. Graceful Fallback: Never drop an incoming call if CRM is slow or unavailable
    const durationMs = Date.now() - startTime;
    logger.error('Error processing inbound customer search, serving fallback', { durationMs, phone: searchPhone }, error);

    const fallbackResponse: RetellInboundWebhookResponse = {
      call_inbound: {
        ...(agentId ? { agent_id: agentId } : {}),
        dynamic_variables: {
          customer_found: 'false',
          customer_name: '',
          first_name: '',
          last_name: '',
          customer_phone: searchPhone,
          customer_email: '',
          company_name: '',
          customer_type: 'New Caller',
          lead_status: '',
          customer_interest: '',
          customer_context: 'CRM lookup was temporarily unavailable. Treat the caller as a new caller.',
          crm_lookup_status: 'unavailable',
        },
      },
    };

    return res.status(200).json(fallbackResponse);
  }
}
