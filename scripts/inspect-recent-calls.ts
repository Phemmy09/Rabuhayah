import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const apiKey = process.env.RETELL_API_KEY || '';

async function inspectRecentCalls() {
  if (!apiKey) {
    console.error('ERROR: RETELL_API_KEY is not set. Check your .env.local file.');
    process.exit(1);
  }

  console.log('Fetching last 5 calls from Retell (v3 API)...\n');
  const res = await fetch('https://api.retellai.com/v3/list-calls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sort_order: 'descending',
      limit: 5,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`API Error ${res.status}: ${text}`);
    return;
  }

  const calls = await res.json();
  const callList = Array.isArray(calls) ? calls : calls?.data || calls?.calls || [];

  if (callList.length === 0) {
    console.log('No recent calls found.');
    return;
  }

  for (const c of callList) {
    console.log('====================================================');
    console.log('Call ID:', c.call_id);
    console.log('From:', c.from_number, '->', 'To:', c.to_number);
    console.log('Agent ID:', c.agent_id);
    console.log('Type:', c.call_type || 'N/A');
    console.log('Status:', c.call_status || 'N/A');
    console.log('Start Time:', c.start_timestamp ? new Date(c.start_timestamp).toISOString() : 'N/A');
    console.log('End Time:', c.end_timestamp ? new Date(c.end_timestamp).toISOString() : 'N/A');
    console.log('Duration:', c.duration_ms ? `${Math.round(c.duration_ms / 1000)}s` : 'N/A');
    console.log('Disconnection:', c.disconnection_reason || 'N/A');

    // Check for personalization dynamic variables
    const dvars = c.retell_llm_dynamic_variables || c.dynamic_variables || {};
    console.log('\n--- PERSONALISATION Dynamic Variables ---');
    if (Object.keys(dvars).length > 0) {
      console.log('  customer_found:', dvars.customer_found || 'NOT SET');
      console.log('  customer_name:', dvars.customer_name || 'NOT SET');
      console.log('  first_name:', dvars.first_name || 'NOT SET');
      console.log('  customer_type:', dvars.customer_type || 'NOT SET');
      console.log('  company_name:', dvars.company_name || 'NOT SET');
      console.log('  customer_context:', (dvars.customer_context || 'NOT SET').slice(0, 150));
      console.log('  Full dynamic_variables:', JSON.stringify(dvars, null, 2));
    } else {
      console.log('  ⚠️  NO DYNAMIC VARIABLES FOUND — Personalization may not be working!');
    }

    console.log('\n--- Call Analysis ---');
    console.log(JSON.stringify(c.call_analysis || 'No analysis', null, 2));
    console.log('');
  }
}

inspectRecentCalls().catch(console.error);
