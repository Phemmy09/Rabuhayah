import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyRetellWebhook } from '../../lib/retell/verification.js';
import { normalizePhone } from '../../lib/phone/normalize.js';
import { findCustomerByPhone } from '../../lib/zoho/customer.js';
import { updateContact } from '../../lib/zoho/contacts.js';
import { updateLead, createLeadIfNotExists } from '../../lib/zoho/leads.js';
import { buildZohoPayload } from '../../lib/zoho/field-mapping.js';
import { logger } from '../../lib/logging/logger.js';
import { config } from '../../lib/config.js';
import { RetellPostCallWebhookRequest, RetellCallObject } from '../../types/retell.js';

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
    logger.warn('Unauthorized post-call webhook: invalid signature');
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid Retell webhook signature' },
    });
  }

  const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as RetellPostCallWebhookRequest;
  const event = payload?.event;
  const call = payload?.call as RetellCallObject | undefined;

  if (!call || !call.call_id) {
    logger.warn('Post-call webhook received without valid call object', undefined, payload);
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing call object' } });
  }

  logger.info(`Received Retell post-call event: ${event}`, {
    callId: call.call_id,
    agentId: call.agent_id,
    fromNumber: call.from_number,
    durationMs: call.duration_ms,
  });

  // We process post-call updates primarily on 'call_analyzed' (or 'call_ended' if analysis is absent)
  if (event !== 'call_analyzed' && event !== 'call_ended') {
    return res.status(200).json({ success: true, message: `Event ${event} acknowledged` });
  }

  try {
    const rawCallerNumber = call.from_number || '';
    const norm = normalizePhone(rawCallerNumber);
    const searchPhone = norm.e164 || rawCallerNumber;

    if (!searchPhone) {
      logger.warn('Cannot sync call to CRM: no caller phone number', { callId: call.call_id });
      return res.status(200).json({ success: true, message: 'No phone number to match' });
    }

    // Extract call analysis details defensively
    const analysis = call.call_analysis || {};
    const customData = analysis.custom_analysis_data || {};

    const callSummary = analysis.call_summary || (call.transcript ? `Call transcript recorded (Duration: ${Math.round((call.duration_ms || 0) / 1000)}s)` : '');
    const userSentiment = analysis.user_sentiment || '';
    const callSuccessful = analysis.call_successful !== undefined ? (analysis.call_successful ? 'Successful' : 'Unsuccessful') : '';
    const callOutcome = analysis.call_outcome || (customData['call_outcome'] as string) || callSuccessful;
    const callIntent = analysis.call_intent || (customData['call_intent'] as string) || '';
    const recordingUrl = call.recording_url || '';
    const durationSeconds = call.duration_ms ? Math.round(call.duration_ms / 1000) : 0;
    const lastCallDate = call.end_timestamp ? new Date(call.end_timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    // Client-specific custom attributes from extraction
    const chargerBrand = (customData['charger_brand'] as string) || analysis.charger_brand;
    const evModel = (customData['ev_make_model'] as string) || (customData['ev_model'] as string) || analysis.ev_make_model;
    const propertyType = (customData['property_type'] as string) || analysis.property_type;
    const quotedPackage = (customData['quoted_package'] as string) || analysis.quoted_package;
    const cableRun = (customData['cable_run_m'] as string) || analysis.cable_run_m;
    const callerName = (customData['caller_name'] as string) || (customData['first_name'] as string) || '';
    const callerEmail = (customData['email'] as string) || (customData['customer_email'] as string) || '';

    // Build Zoho CRM payload using field mapping
    const updateData = buildZohoPayload({
      lastCallSummary: callSummary,
      callOutcome: callOutcome,
      sentiment: userSentiment,
      callIntent: callIntent,
      recordingUrl: recordingUrl,
      conversationId: call.call_id,
      callDuration: durationSeconds,
      lastCallDate: lastCallDate,
      chargerBrand,
      evModel,
      propertyType,
      quotedPackage,
      cableRun,
      description: callSummary ? `AI Call Summary (${lastCallDate}):\n${callSummary}` : undefined,
    });

    // 3. Look up existing Contact or Lead in Zoho CRM
    const customer = await findCustomerByPhone(searchPhone);

    if (customer.found && customer.id) {
      if (customer.module === 'Contacts') {
        logger.info('Updating existing Contact with post-call data', {
          contactId: customer.id,
          callId: call.call_id,
        });
        await updateContact(customer.id, updateData);
      } else if (customer.module === 'Leads') {
        logger.info('Updating existing Lead with post-call data', {
          leadId: customer.id,
          callId: call.call_id,
        });
        await updateLead(customer.id, updateData);
      }
    } else {
      // 4. Unknown Caller Handling
      if (config.business.createLeadsForUnknownCallers) {
        logger.info('Caller not in CRM, preparing duplicate-safe Lead creation', {
          phone: searchPhone,
          callId: call.call_id,
        });

        const nameParts = callerName.trim().split(' ');
        const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';
        const lastName = nameParts.length > 0 && nameParts[0] ? nameParts[nameParts.length - 1] : 'Caller';

        const newLeadPayload = buildZohoPayload({
          firstName: firstName || undefined,
          lastName: lastName,
          phone: searchPhone,
          email: callerEmail || undefined,
          company: (customData['company_name'] as string) || 'Individual',
          leadSource: config.business.leadSource,
          leadStatus: 'Not Contacted',
          ...updateData,
        });

        const leadResult = await createLeadIfNotExists(newLeadPayload, searchPhone, callerEmail);
        logger.info(`Post-call Lead processing completed (isNew: ${leadResult.isNew})`, {
          leadId: leadResult.id || undefined,
          callId: call.call_id,
        });
      } else {
        logger.info('Caller not in CRM, Lead auto-creation is disabled in config', {
          phone: searchPhone,
          callId: call.call_id,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    return res.status(200).json({
      success: true,
      call_id: call.call_id,
      duration_ms: durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Error processing post-call webhook', { durationMs, callId: call.call_id }, error);
    // Return 200 so Retell does not endlessly retry failed parsing if payload was non-recoverable
    return res.status(200).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
