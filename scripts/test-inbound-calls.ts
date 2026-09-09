import dotenv from 'dotenv';
import crypto from 'crypto';
import { findCustomerByPhone } from '../lib/zoho/customer.js';
import { buildRetellDynamicVariables } from '../lib/context/generator.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const apiKey = process.env.RETELL_API_KEY || 'key_c3b87488396a193b8dd4a2630066';
const LIVE_WEBHOOK_URL = 'https://rabuhayah.vercel.app/api/retell/inbound';

const TEST_CALLERS = [
  {
    label: 'Known Contact (Bolu Adeyemi)',
    phone: '+14245460129',
  },
  {
    label: 'UAE Business Contact',
    phone: '+971509732525',
  },
  {
    label: 'Brand New / Unknown Caller',
    phone: '+19998887777',
  },
];

async function runLocalPipelineTest(phone: string) {
  const start = Date.now();
  const customer = await findCustomerByPhone(phone);
  const vars = buildRetellDynamicVariables(customer, 'agent_42eeb5d0bd58551aa744b7b003');
  const duration = Date.now() - start;

  return {
    durationMs: duration,
    customerFound: vars.customer_found === 'true',
    customerName: vars.customer_name,
    firstName: vars.first_name,
    customerType: vars.customer_type,
    customerContext: vars.customer_context,
    fullVariables: vars,
  };
}

async function runLiveWebhookTest(phone: string) {
  const payload = {
    event: 'call_inbound',
    call_inbound: {
      from_number: phone,
      to_number: '+97126591017',
      agent_id: 'agent_42eeb5d0bd58551aa744b7b003',
    },
  };

  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', apiKey).update(rawBody).digest('hex');

  const start = Date.now();
  const res = await fetch(LIVE_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-retell-signature': signature,
    },
    body: rawBody,
  });

  const durationMs = Date.now() - start;
  const status = res.status;
  let data: any = null;
  try {
    data = await res.json();
  } catch (e: any) {
    data = await res.text();
  }

  return {
    status,
    durationMs,
    data,
  };
}

async function main() {
  console.log('========================================================================');
  console.log('🧪 RETELL AI INBOUND CALL PERSONALIZATION & WEBHOOK TEST SUITE');
  console.log('========================================================================\n');

  for (const testCase of TEST_CALLERS) {
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`📞 Testing Inbound Caller: ${testCase.label} (${testCase.phone})`);
    console.log(`------------------------------------------------------------------------`);

    // 1. Direct Local CRM & Context Generation
    console.log(`[Stage 1: CRM Lookup & Prompt Personalization]`);
    try {
      const localResult = await runLocalPipelineTest(testCase.phone);
      console.log(`  ⏱️ Lookup Time:   ${localResult.durationMs}ms`);
      console.log(`  🔍 CRM Found:     ${localResult.customerFound ? 'YES ✅' : 'NO (Graceful Fallback) ℹ️'}`);
      console.log(`  👤 Full Name:     "${localResult.customerName || 'None'}"`);
      console.log(`  👋 First Name:    "${localResult.firstName}"`);
      console.log(`  🏷️ Customer Type: "${localResult.customerType}"`);
      console.log(`  📝 CRM Context:   "${localResult.customerContext}"`);

      // Simulated Greeting
      if (localResult.customerFound) {
        console.log(`  🎙️ Maryam Greeting Preview:`);
        console.log(`     "Hi ${localResult.firstName}, welcome to CATEC & SHABIK! How can I direct your call today?"`);
      } else {
        console.log(`  🎙️ Maryam Greeting Preview:`);
        console.log(`     "Hello, welcome to CATEC & SHABIK! How can I direct your call today?"`);
      }
    } catch (err: any) {
      console.error(`  ❌ Local lookup error:`, err.message);
    }

    // 2. Live Deployed Webhook Test
    console.log(`\n[Stage 2: Live Deployed Webhook at ${LIVE_WEBHOOK_URL}]`);
    try {
      const liveResult = await runLiveWebhookTest(testCase.phone);
      console.log(`  📡 HTTP Status:   ${liveResult.status} ${liveResult.status === 200 ? '✅' : '❌'}`);
      console.log(`  ⏱️ Network RTT:   ${liveResult.durationMs}ms`);
      if (liveResult.status === 200) {
        const returnedVars = liveResult.data?.call_inbound?.dynamic_variables;
        console.log(`  ✨ Dynamic Variables Returned to Retell:`);
        console.log(`     - customer_found:  ${returnedVars?.customer_found}`);
        console.log(`     - first_name:      ${returnedVars?.first_name}`);
        console.log(`     - customer_name:   ${returnedVars?.customer_name}`);
        console.log(`     - customer_type:   ${returnedVars?.customer_type}`);
      } else {
        console.log(`  ⚠️ Response data:`, liveResult.data);
      }
    } catch (err: any) {
      console.error(`  ❌ Live webhook error:`, err.message);
    }
  }

  console.log('\n========================================================================');
  console.log('🎉 INBOUND TEST COMPLETE');
  console.log('========================================================================');
}

main().catch(console.error);
