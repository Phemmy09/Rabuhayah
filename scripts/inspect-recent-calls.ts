import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const apiKey = process.env.RETELL_API_KEY || 'key_c3b87488396a193b8dd4a2630066';

async function inspectRecentCalls() {
  console.log('Fetching last 5 calls from Retell...');
  const res = await fetch('https://api.retellai.com/v2/list-calls?limit=5', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const calls = await res.json();

  if (!Array.isArray(calls)) {
    console.log('Response:', calls);
    return;
  }

  for (const c of calls) {
    console.log('====================================================');
    console.log('Call ID:', c.call_id);
    console.log('From:', c.from_number, '-> To:', c.to_number);
    console.log('Agent ID:', c.agent_id);
    console.log('Start Time:', new Date(c.start_timestamp).toISOString());
    console.log('End Time:', c.end_timestamp ? new Date(c.end_timestamp).toISOString() : 'N/A');
    console.log('Dynamic Variables in Call:', JSON.stringify(c.retell_llm_dynamic_variables || c.dynamic_variables, null, 2));
    console.log('Call Inbound Object:', JSON.stringify(c.call_inbound, null, 2));
    console.log('Call Analysis:', JSON.stringify(c.call_analysis, null, 2));
    console.log('Transcript:', c.transcript || 'No transcript');
  }
}

inspectRecentCalls().catch(console.error);
