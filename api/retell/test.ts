import type { VercelRequest, VercelResponse } from '@vercel/node';
import { normalizePhone } from '../../lib/phone/normalize.js';
import { findCustomerByPhone } from '../../lib/zoho/customer.js';
import { buildRetellDynamicVariables } from '../../lib/context/generator.js';
import { config } from '../../lib/config.js';
import { RetellInboundWebhookResponse } from '../../types/retell.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security check in production
  if (config.env === 'production') {
    const diagnosticKey = req.headers['x-diagnostic-key'] || req.query.key;
    if (!config.business.diagnosticApiKey || diagnosticKey !== config.business.diagnosticApiKey) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Diagnostic endpoint is disabled in production' },
      });
    }
  }

  const payload = req.body || {};
  const inbound = payload.call_inbound || payload;
  const rawPhone = inbound.from_number || req.query.phone || '+2348012345678';
  const agentId = inbound.agent_id || 'test-agent';

  const startTime = Date.now();
  const normalized = normalizePhone(String(rawPhone));

  try {
    const customer = await findCustomerByPhone(normalized.e164 || String(rawPhone));
    const dynamicVariables = buildRetellDynamicVariables(customer, agentId);

    const retellResponse: RetellInboundWebhookResponse = {
      call_inbound: {
        agent_id: agentId,
        dynamic_variables: dynamicVariables,
      },
    };

    const durationMs = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      service: 'retell-simulation-test',
      durationMs,
      phoneNormalization: normalized,
      customerRecord: customer,
      retellInboundResponse: retellResponse,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown simulation error',
      durationMs,
    });
  }
}
